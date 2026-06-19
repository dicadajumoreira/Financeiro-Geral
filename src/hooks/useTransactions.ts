import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import type { Transaction } from '@/types/database'

/**
 * Busca lançamentos respeitando o seletor de empresa do topo:
 * empresa selecionada → só dela; nenhuma → consolidado de toda a organização.
 */
export function useTransactions() {
  const { org, currentCompany } = useOrg()
  return useQuery({
    queryKey: ['tx-report', org?.id, currentCompany?.id ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('transactions')
        .select('*, companies(trade_name, legal_name), chart_of_accounts(name, dre_group, type)')
        .neq('status', 'cancelado')
        .order('due_date')
      if (currentCompany) q = q.eq('company_id', currentCompany.id)
      const { data, error } = await q
      if (error) throw error
      return data as (Transaction & {
        companies: { trade_name: string | null; legal_name: string } | null
        chart_of_accounts: { name: string; dre_group: string | null; type: string } | null
      })[]
    },
    enabled: !!org,
  })
}
