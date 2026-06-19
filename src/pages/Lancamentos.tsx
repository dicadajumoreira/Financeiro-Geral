import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Paperclip, CheckCircle2, ArrowLeftRight, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatBRL, formatDate, todayISO } from '@/lib/format'
import type { BankAccount, ChartAccount, Company, Contact, CostCenter, Transaction, TransactionKind, TransactionStatus } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequireCompany } from '@/components/layout/RequireCompany'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageLoader, Spinner } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { AttachmentsManager } from '@/components/AttachmentsManager'

const STATUS_META: Record<TransactionStatus, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' | 'default' }> = {
  pendente: { label: 'Pendente', variant: 'warning' },
  pago: { label: 'Pago/Recebido', variant: 'success' },
  parcial: { label: 'Parcial', variant: 'default' },
  atrasado: { label: 'Atrasado', variant: 'destructive' },
  cancelado: { label: 'Cancelado', variant: 'secondary' },
}

export default function Lancamentos() {
  return (
    <div>
      <PageHeader title="Lançamentos" description="Receitas e despesas — avulsas ou recorrentes — com anexos." />
      <RequireCompany>{(company) => <Inner company={company} />}</RequireCompany>
    </div>
  )
}

interface TxForm extends Partial<Transaction> {}

function Inner({ company }: { company: Company }) {
  const { org, canWrite } = useOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<TxForm | null>(null)
  const [kindFilter, setKindFilter] = useState<'todos' | TransactionKind>('todos')
  const [statusFilter, setStatusFilter] = useState<'todos' | TransactionStatus>('todos')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)

  const baseKey = ['transactions', company.id]
  // Invalida a lista E os relatórios (Dashboard/Fluxo/DRE) a cada mudança.
  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: baseKey })
    await qc.invalidateQueries({ queryKey: ['tx-report'] })
  }

  const { data: txs, isLoading } = useQuery({
    queryKey: baseKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, contacts(name), chart_of_accounts(name)')
        .eq('company_id', company.id)
        .order('due_date', { ascending: false })
        .limit(500)
      if (error) throw error
      return data as (Transaction & { contacts: { name: string } | null; chart_of_accounts: { name: string } | null })[]
    },
  })

  // Cadastros auxiliares para os selects.
  const { data: accounts } = useQuery({
    queryKey: ['coa', company.id],
    queryFn: async () => (await supabase.from('chart_of_accounts').select('*').eq('company_id', company.id).eq('is_active', true).order('name')).data as ChartAccount[],
  })
  const { data: costCenters } = useQuery({
    queryKey: ['cost_centers', company.id],
    queryFn: async () => (await supabase.from('cost_centers').select('*').eq('company_id', company.id).order('name')).data as CostCenter[],
  })
  const { data: contacts } = useQuery({
    queryKey: ['contacts', org?.id],
    queryFn: async () => (await supabase.from('contacts').select('*').order('name')).data as Contact[],
  })
  const { data: banks } = useQuery({
    queryKey: ['bank_accounts', company.id],
    queryFn: async () => (await supabase.from('bank_accounts').select('*').eq('company_id', company.id).order('name')).data as BankAccount[],
  })

  const save = useMutation({
    mutationFn: async (form: TxForm) => {
      const payload = {
        org_id: org!.id,
        company_id: company.id,
        kind: form.kind ?? 'despesa',
        description: form.description!,
        amount: form.amount ?? 0,
        account_id: form.account_id || null,
        cost_center_id: form.cost_center_id || null,
        contact_id: form.contact_id || null,
        bank_account_id: form.bank_account_id || null,
        competence_date: form.competence_date || form.due_date || todayISO(),
        due_date: form.due_date || todayISO(),
        payment_date: form.payment_date || null,
        status: form.status ?? 'pendente',
        payment_method: form.payment_method || null,
        document_number: form.document_number || null,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      }
      if (form.id) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', form.id)
        if (error) throw error
        return form.id
      } else {
        const { data, error } = await supabase.from('transactions').insert(payload).select('id').single()
        if (error) throw error
        return data.id as string
      }
    },
    onSuccess: async (id) => {
      await invalidateAll()
      // Mantém o modal aberto com o id (para permitir anexos logo após criar).
      setEditing((prev) => (prev ? { ...prev, id } : prev))
    },
  })

  const markPaid = useMutation({
    mutationFn: async (tx: Transaction) => {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'pago', payment_date: todayISO(), paid_amount: tx.amount })
        .eq('id', tx.id)
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const removeOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidateAll,
  })

  const removeMany = useMutation({
    mutationFn: async (ids: string[]) => {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await supabase.from('transactions').delete().in('id', ids.slice(i, i + 200))
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setSelected(new Set())
      setConfirmBulk(false)
      await invalidateAll()
    },
  })

  const filtered = useMemo(
    () =>
      (txs ?? []).filter(
        (t) => (kindFilter === 'todos' || t.kind === kindFilter) && (statusFilter === 'todos' || t.status === statusFilter),
      ),
    [txs, kindFilter, statusFilter],
  )

  const totals = useMemo(() => {
    let receitas = 0
    let despesas = 0
    for (const t of filtered) {
      if (t.status === 'cancelado') continue
      if (t.kind === 'receita') receitas += Number(t.amount)
      else despesas += Number(t.amount)
    }
    return { receitas, despesas, saldo: receitas - despesas }
  }, [filtered])

  if (isLoading) return <PageLoader />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className="max-w-[180px]">
          <option value="todos">Todos os tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="max-w-[180px]">
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-success">Receitas: {formatBRL(totals.receitas)}</span>
          <span className="text-destructive">Despesas: {formatBRL(totals.despesas)}</span>
          <span className="font-semibold">Saldo: {formatBRL(totals.saldo)}</span>
          {canWrite && (
            <Button onClick={() => setEditing({ kind: 'despesa', status: 'pendente', due_date: todayISO(), competence_date: todayISO() })}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          )}
        </div>
      </div>

      {canWrite && selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          <span>{selected.size} selecionado(s)</span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirmBulk(true)}>
            <Trash2 className="h-4 w-4" /> Excluir selecionados
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8" />
              <p className="text-sm">Nenhum lançamento encontrado.</p>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  {canWrite && (
                    <TH className="w-8">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every((t) => selected.has(t.id))}
                        onChange={(e) =>
                          setSelected(e.target.checked ? new Set(filtered.map((t) => t.id)) : new Set())
                        }
                      />
                    </TH>
                  )}
                  <TH>Vencimento</TH>
                  <TH>Descrição</TH>
                  <TH>Categoria</TH>
                  <TH>Contato</TH>
                  <TH className="text-right">Valor</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((t) => (
                  <TR key={t.id}>
                    {canWrite && (
                      <TD>
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(t.id)
                              else next.delete(t.id)
                              return next
                            })
                          }
                        />
                      </TD>
                    )}
                    <TD className="whitespace-nowrap">{formatDate(t.due_date)}</TD>
                    <TD className="font-medium">{t.description}</TD>
                    <TD className="text-sm text-muted-foreground">{t.chart_of_accounts?.name || '—'}</TD>
                    <TD className="text-sm text-muted-foreground">{t.contacts?.name || '—'}</TD>
                    <TD className={`text-right tabular-nums ${t.kind === 'receita' ? 'text-success' : 'text-destructive'}`}>
                      {t.kind === 'receita' ? '+' : '−'} {formatBRL(t.amount)}
                    </TD>
                    <TD>
                      <Badge variant={STATUS_META[t.status].variant}>{STATUS_META[t.status].label}</Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        {canWrite && t.status !== 'pago' && t.status !== 'cancelado' && (
                          <Button variant="ghost" size="sm" title="Marcar como pago/recebido" onClick={() => markPaid.mutate(t)}>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setEditing(t)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Excluir"
                            onClick={() => {
                              if (confirm(`Excluir o lançamento "${t.description}"?`)) removeOne.mutate(t.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar lançamento' : 'Novo lançamento'}
        className="max-w-2xl"
      >
        {editing && (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                save.mutate(editing)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
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
                  <Label>Categoria (plano de contas)</Label>
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
                  <Label>Centro de custo</Label>
                  <Select value={editing.cost_center_id ?? ''} onChange={(e) => setEditing({ ...editing, cost_center_id: e.target.value })}>
                    <option value="">—</option>
                    {(costCenters ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contato (cliente/fornecedor)</Label>
                  <Select value={editing.contact_id ?? ''} onChange={(e) => setEditing({ ...editing, contact_id: e.target.value })}>
                    <option value="">—</option>
                    {(contacts ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Conta bancária</Label>
                  <Select value={editing.bank_account_id ?? ''} onChange={(e) => setEditing({ ...editing, bank_account_id: e.target.value })}>
                    <option value="">—</option>
                    {(banks ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Competência</Label>
                  <Input type="date" value={editing.competence_date ?? ''} onChange={(e) => setEditing({ ...editing, competence_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vencimento *</Label>
                  <Input type="date" value={editing.due_date ?? ''} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Pagamento</Label>
                  <Input type="date" value={editing.payment_date ?? ''} onChange={(e) => setEditing({ ...editing, payment_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editing.status ?? 'pendente'} onChange={(e) => setEditing({ ...editing, status: e.target.value as TransactionStatus })}>
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Forma de pagamento</Label>
                  <Input value={editing.payment_method ?? ''} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })} placeholder="PIX, Boleto…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nº documento</Label>
                  <Input value={editing.document_number ?? ''} onChange={(e) => setEditing({ ...editing, document_number: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              {save.isError && <p className="text-sm text-destructive">{(save.error as Error).message}</p>}
              <div className="flex items-center justify-between pt-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {save.isPending && <Spinner className="h-4 w-4" />}
                  {save.isSuccess && !save.isPending && 'Salvo ✓'}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Fechar
                  </Button>
                  <Button type="submit" disabled={save.isPending}>
                    {editing.id ? 'Salvar alterações' : 'Criar lançamento'}
                  </Button>
                </div>
              </div>
            </form>

            {/* Anexos: disponíveis após o lançamento existir */}
            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" /> Anexos (comprovantes, NF, boletos)
              </div>
              {editing.id ? (
                <AttachmentsManager orgId={org!.id} transactionId={editing.id} canWrite={canWrite} />
              ) : (
                <p className="text-xs text-muted-foreground">Salve o lançamento para anexar arquivos.</p>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmação de exclusão em lote */}
      <Dialog open={confirmBulk} onClose={() => setConfirmBulk(false)} title="Excluir lançamentos">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <strong>{selected.size}</strong> lançamento(s)? Esta ação não pode ser desfeita.
          </p>
          {removeMany.isError && <p className="text-sm text-destructive">{(removeMany.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmBulk(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removeMany.mutate([...selected])}
              disabled={removeMany.isPending}
            >
              {removeMany.isPending ? 'Excluindo…' : `Excluir ${selected.size}`}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
