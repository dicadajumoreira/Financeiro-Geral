import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Repeat, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatBRL, formatDate, todayISO } from '@/lib/format'
import { occurrenceDates } from '@/lib/recurrence'
import type { ChartAccount, Company, Contact, Recurrence, RecurrenceFrequency, TransactionKind } from '@/types/database'
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

const FREQ: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

export default function Recorrencias() {
  return (
    <div>
      <PageHeader title="Recorrências" description="Regras de receitas e despesas que se repetem. Gere os lançamentos com um clique." />
      <RequireCompany>{(company) => <Inner company={company} />}</RequireCompany>
    </div>
  )
}

function Inner({ company }: { company: Company }) {
  const { org, canWrite } = useOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Recurrence> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const { data: recs, isLoading } = useQuery({
    queryKey: ['recurrences', company.id],
    queryFn: async () => (await supabase.from('recurrences').select('*').eq('company_id', company.id).order('created_at', { ascending: false })).data as Recurrence[],
  })
  const { data: accounts } = useQuery({
    queryKey: ['coa', company.id],
    queryFn: async () => (await supabase.from('chart_of_accounts').select('*').eq('company_id', company.id).order('name')).data as ChartAccount[],
  })
  const { data: contacts } = useQuery({
    queryKey: ['contacts', org?.id],
    queryFn: async () => (await supabase.from('contacts').select('*').order('name')).data as Contact[],
  })

  const save = useMutation({
    mutationFn: async (form: Partial<Recurrence>) => {
      const payload = {
        org_id: org!.id,
        company_id: company.id,
        kind: form.kind ?? 'despesa',
        description: form.description!,
        amount: form.amount ?? 0,
        account_id: form.account_id || null,
        contact_id: form.contact_id || null,
        frequency: form.frequency ?? 'mensal',
        start_date: form.start_date || todayISO(),
        end_date: form.end_date || null,
        occurrences: form.occurrences || null,
        is_active: form.is_active ?? true,
      }
      if (form.id) {
        const { error } = await supabase.from('recurrences').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('recurrences').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['recurrences', company.id] })
    },
  })

  // Gera lançamentos pendentes da recorrência até hoje, evitando duplicatas.
  const generate = useMutation({
    mutationFn: async (rec: Recurrence) => {
      const dates = occurrenceDates(rec, new Date())
      const { data: existing } = await supabase
        .from('transactions')
        .select('due_date')
        .eq('recurrence_id', rec.id)
      const done = new Set((existing ?? []).map((e) => e.due_date))
      const toCreate = dates.filter((d) => !done.has(d))
      if (toCreate.length === 0) return 0
      const rows = toCreate.map((d) => ({
        org_id: rec.org_id,
        company_id: rec.company_id,
        kind: rec.kind,
        description: rec.description,
        amount: rec.amount,
        account_id: rec.account_id,
        contact_id: rec.contact_id,
        bank_account_id: rec.bank_account_id,
        competence_date: d,
        due_date: d,
        status: 'pendente' as const,
        recurrence_id: rec.id,
        created_by: user?.id ?? null,
      }))
      const { error } = await supabase.from('transactions').insert(rows)
      if (error) throw error
      return toCreate.length
    },
    onSuccess: async (count) => {
      setMsg(count ? `${count} lançamento(s) gerado(s).` : 'Nenhum lançamento novo a gerar.')
      await qc.invalidateQueries({ queryKey: ['transactions', company.id] })
      await qc.invalidateQueries({ queryKey: ['tx-report'] })
      setTimeout(() => setMsg(null), 4000)
    },
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-3">
        {msg && <span className="text-sm text-success">{msg}</span>}
        {canWrite && (
          <Button onClick={() => setEditing({ kind: 'despesa', frequency: 'mensal', is_active: true, start_date: todayISO() })}>
            <Plus className="h-4 w-4" /> Nova recorrência
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {recs && recs.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Descrição</TH>
                  <TH>Tipo</TH>
                  <TH>Frequência</TH>
                  <TH>Início</TH>
                  <TH className="text-right">Valor</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {recs.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.description}</TD>
                    <TD>
                      <Badge variant={r.kind === 'receita' ? 'success' : 'destructive'}>{r.kind}</Badge>
                    </TD>
                    <TD>{FREQ.find((f) => f.value === r.frequency)?.label}</TD>
                    <TD>{formatDate(r.start_date)}</TD>
                    <TD className="text-right tabular-nums">{formatBRL(r.amount)}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <Button variant="ghost" size="sm" title="Gerar lançamentos pendentes" onClick={() => generate.mutate(r)} disabled={generate.isPending}>
                            <Play className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Repeat className="h-8 w-8" />
              <p className="text-sm">Nenhuma recorrência cadastrada.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar recorrência' : 'Nova recorrência'} className="max-w-xl">
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(editing)
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={editing.kind ?? 'despesa'} onChange={(e) => setEditing({ ...editing, kind: e.target.value as TransactionKind })}>
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={editing.amount ?? ''} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={editing.account_id ?? ''} onChange={(e) => setEditing({ ...editing, account_id: e.target.value })}>
                  <option value="">—</option>
                  {(accounts ?? []).filter((a) => a.type === (editing.kind ?? 'despesa')).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contato</Label>
                <Select value={editing.contact_id ?? ''} onChange={(e) => setEditing({ ...editing, contact_id: e.target.value })}>
                  <option value="">—</option>
                  {(contacts ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select value={editing.frequency ?? 'mensal'} onChange={(e) => setEditing({ ...editing, frequency: e.target.value as RecurrenceFrequency })}>
                  {FREQ.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nº de ocorrências (opcional)</Label>
                <Input type="number" value={editing.occurrences ?? ''} onChange={(e) => setEditing({ ...editing, occurrences: e.target.value ? Number(e.target.value) : null })} placeholder="Ilimitado" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input type="date" value={editing.start_date ?? ''} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Fim (opcional)</Label>
                <Input type="date" value={editing.end_date ?? ''} onChange={(e) => setEditing({ ...editing, end_date: e.target.value || null })} />
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
