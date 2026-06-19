import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ListTree, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import type { AccountType, ChartAccount, Company } from '@/types/database'
import { CHART_TEMPLATE } from '@/lib/finance/chartTemplate'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequireCompany } from '@/components/layout/RequireCompany'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

// Plano de contas padrão (categorias reais da operação) — ver chartTemplate.
const DEFAULT_ACCOUNTS = CHART_TEMPLATE

export default function PlanoDeContas() {
  return (
    <div>
      <PageHeader title="Plano de Contas" description="Categorias de receita e despesa — uma estrutura por empresa." />
      <RequireCompany>{(company) => <Inner company={company} />}</RequireCompany>
    </div>
  )
}

function Inner({ company }: { company: Company }) {
  const { org, canWrite } = useOrg()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<ChartAccount> | null>(null)

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['coa', company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', company.id)
        .order('type')
        .order('name')
      if (error) throw error
      return data as ChartAccount[]
    },
  })

  const save = useMutation({
    mutationFn: async (form: Partial<ChartAccount>) => {
      const payload = {
        org_id: org!.id,
        company_id: company.id,
        name: form.name!,
        type: form.type ?? 'despesa',
        code: form.code || null,
        dre_group: form.dre_group || null,
        is_active: form.is_active ?? true,
      }
      if (form.id) {
        const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('chart_of_accounts').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['coa', company.id] })
    },
  })

  const seed = useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_ACCOUNTS.map((a) => ({ ...a, org_id: org!.id, company_id: company.id }))
      const { error } = await supabase.from('chart_of_accounts').insert(rows)
      if (error) throw error
    },
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['coa', company.id] }),
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        {accounts && accounts.length === 0 && canWrite && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <Sparkles className="h-4 w-4" /> Usar plano padrão
          </Button>
        )}
        {canWrite && (
          <Button onClick={() => setEditing({ type: 'despesa', is_active: true })}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {accounts && accounts.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Conta</TH>
                  <TH>Tipo</TH>
                  <TH>Grupo DRE</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {accounts.map((a) => (
                  <TR key={a.id}>
                    <TD className="text-muted-foreground">{a.code || '—'}</TD>
                    <TD className="font-medium">{a.name}</TD>
                    <TD>
                      <Badge variant={a.type === 'receita' ? 'success' : 'destructive'}>{a.type}</Badge>
                    </TD>
                    <TD className="text-sm text-muted-foreground">{a.dre_group || '—'}</TD>
                    <TD className="text-right">
                      {canWrite && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <ListTree className="h-8 w-8" />
              <p className="text-sm">Nenhuma conta. Crie manualmente ou use o plano padrão.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar conta' : 'Nova conta'}>
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(editing)
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Nome *</Label>
                <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={editing.type ?? 'despesa'} onChange={(e) => setEditing({ ...editing, type: e.target.value as AccountType })}>
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Grupo DRE</Label>
                <Input value={editing.dre_group ?? ''} onChange={(e) => setEditing({ ...editing, dre_group: e.target.value })} placeholder="Ex.: Despesas Operacionais" />
              </div>
            </div>
            {save.isError && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  )
}
