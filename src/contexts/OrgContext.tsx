import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Company, MembershipRole, Organization } from '@/types/database'

interface OrgState {
  loading: boolean
  org: Organization | null
  role: MembershipRole | null
  companies: Company[]
  /** Empresa selecionada no seletor; null = visão consolidada (todas). */
  currentCompany: Company | null
  setCurrentCompany: (company: Company | null) => void
  canWrite: boolean
  refresh: () => Promise<void>
}

const OrgContext = createContext<OrgState | undefined>(undefined)

const STORAGE_KEY = 'fg.currentCompanyId'

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<Organization | null>(null)
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null)

  const setCurrentCompany = useCallback((company: Company | null) => {
    setCurrentCompanyState(company)
    if (company) localStorage.setItem(STORAGE_KEY, company.id)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) {
      setOrg(null)
      setRole(null)
      setCompanies([])
      setLoading(false)
      return
    }
    // Não usamos setLoading(true) aqui: recarregamentos em segundo plano
    // (ex.: ao voltar para a aba) não devem desmontar a tela e fechar modais.

    // Pega a primeira organização do usuário (MVP: 1 org por usuário típico).
    const { data: memberships } = await supabase
      .from('memberships')
      .select('role, org_id')
      .order('created_at', { ascending: true })
      .limit(1)

    const membership = memberships?.[0]
    if (!membership) {
      setOrg(null)
      setRole(null)
      setCompanies([])
      setLoading(false)
      return
    }

    const { data: orgRow } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', membership.org_id)
      .single()

    setOrg((orgRow as Organization) ?? null)
    setRole(membership.role as MembershipRole)

    const { data: comps } = await supabase
      .from('companies')
      .select('*')
      .eq('org_id', membership.org_id)
      .order('legal_name', { ascending: true })

    const list = (comps ?? []) as Company[]
    setCompanies(list)

    // Restaura a empresa previamente selecionada, se ainda existir.
    const savedId = localStorage.getItem(STORAGE_KEY)
    const saved = list.find((c) => c.id === savedId) ?? null
    setCurrentCompanyState(saved)

    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const canWrite = role === 'owner' || role === 'admin' || role === 'finance'

  return (
    <OrgContext.Provider
      value={{ loading, org, role, companies, currentCompany, setCurrentCompany, canWrite, refresh }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg() {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg deve ser usado dentro de OrgProvider')
  return ctx
}
