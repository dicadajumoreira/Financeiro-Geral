import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Landmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { formatBRL } from '@/lib/format'
import type { BankAccount, Company } from '@/types/database'
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

const TYPES = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'caixa', label: 'Caixa / Dinheiro' },
  { value: 'aplicacao', label: 'Aplicação' },
]

export default function ContasBancarias() {
  return (
    <div>
      <PageHeader title="Contas Bancárias" description="Contas e caixas de cada empresa para movimentação financeira." />
      <RequireCompany>{(company) => <Inner company={company} />}</RequireCompany>
    </div>
  )
}

function Inner({ company }: { company: Company }) {
  const { org, canWrite } = useOrg()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<BankAccount> | null>(null)

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['bank_accounts', company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('bank_accounts').select('*').eq('company_id', company.id).order('name')
      if (error) throw error
      return data as BankAccount[]
    },
  })

  const save = useMutation({
    mutationFn: async (form: Partial<BankAccount>) => {
      const payload = {
        org_id: org!.id,
        company_id: company.id,
        name: form.name!,
        bank_name: form.bank_name || null,
        agency: form.agency || null,
        account_number: form.account_number || null,
        type: form.type || 'corrente',
        opening_balance: form.opening_balance ?? 0,
        is_active: form.is_active ?? true,
      }
      if (form.id) {
        const { error } = await supabase.from('bank_accounts').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('bank_accounts').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['bank_accounts', company.id] })
    },
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {canWrite && (
          <Button onClick={() => setEditing({ type: 'corrente', is_active: true, opening_balance: 0 })}>
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
                  <TH>Conta</TH>
                  <TH>Banco</TH>
                  <TH>Tipo</TH>
                  <TH className="text-right">Saldo inicial</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {accounts.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{a.name}</TD>
                    <TD>
                      {a.bank_name || '—'}
                      {a.account_number && (
                        <span className="block text-xs text-muted-foreground">
                          Ag {a.agency || '—'} · CC {a.account_number}
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Badge variant="secondary">{TYPES.find((t) => t.value === a.type)?.label ?? a.type}</Badge>
                    </TD>
                    <TD className="text-right tabular-nums">{formatBRL(a.opening_balance)}</TD>
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
              <Landmark className="h-8 w-8" />
              <p className="text-sm">Nenhuma conta bancária cadastrada.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar conta' : 'Nova conta bancária'}>
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(editing)
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Apelido da conta *</Label>
              <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Itaú Principal" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input value={editing.bank_name ?? ''} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={editing.type ?? 'corrente'} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={editing.agency ?? ''} onChange={(e) => setEditing({ ...editing, agency: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input value={editing.account_number ?? ''} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo inicial</Label>
              <Input
                type="number"
                step="0.01"
                value={editing.opening_balance ?? 0}
                onChange={(e) => setEditing({ ...editing, opening_balance: Number(e.target.value) })}
              />
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
