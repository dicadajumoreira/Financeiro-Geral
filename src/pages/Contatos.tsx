import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Users, Search, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { formatDocument } from '@/lib/format'
import { fetchCNPJ, isCNPJ } from '@/lib/finance/cnpj'
import { PIX_TIPOS, TIPOS_CONTA, type BankInfo } from '@/lib/finance/bankInfo'
import type { Contact, ContactType } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
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

const TYPES: { value: ContactType; label: string }[] = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'ambos', label: 'Cliente e Fornecedor' },
  { value: 'funcionario', label: 'Funcionário' },
]

export default function Contatos() {
  const { org, canWrite } = useOrg()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<Partial<Contact> | null>(null)
  const [filter, setFilter] = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null)

  const bank = (editing?.bank_info as BankInfo | null) ?? {}
  const setBank = (patch: Partial<BankInfo>) =>
    setEditing((prev) => (prev ? { ...prev, bank_info: { ...((prev.bank_info as BankInfo | null) ?? {}), ...patch } } : prev))

  async function lookupCNPJ(doc: string) {
    if (!isCNPJ(doc) || !editing) return
    setCnpjLoading(true)
    setCnpjMsg(null)
    try {
      const d = await fetchCNPJ(doc)
      setEditing((prev) =>
        prev
          ? {
              ...prev,
              name: prev.name || d.nomeFantasia || d.razaoSocial,
              email: prev.email || d.email,
              phone: prev.phone || d.telefone,
              address: d.address,
            }
          : prev,
      )
      setCnpjMsg('Dados preenchidos pela Receita ✓')
    } catch (e) {
      setCnpjMsg((e as Error).message)
    } finally {
      setCnpjLoading(false)
    }
  }

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').order('name')
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!org,
  })

  const save = useMutation({
    mutationFn: async (form: Partial<Contact>) => {
      const payload = {
        org_id: org!.id,
        type: form.type ?? 'cliente',
        name: form.name!,
        document: form.document || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address ?? null,
        bank_info: form.bank_info ?? null,
        notes: form.notes || null,
        is_active: form.is_active ?? true,
      }
      if (form.id) {
        const { error } = await supabase.from('contacts').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contacts').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['contacts'] })
    },
  })

  if (isLoading) return <PageLoader />

  const filtered = (contacts ?? []).filter(
    (c) =>
      !filter ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      (c.document ?? '').includes(filter),
  )

  return (
    <div>
      <PageHeader
        title="Contatos"
        description="Clientes, fornecedores e funcionários vinculáveis aos lançamentos."
        actions={
          canWrite && (
            <>
              <Button variant="outline" onClick={() => navigate('/importar-favorecidos')}>
                <Upload className="h-4 w-4" /> Importar favorecidos
              </Button>
              <Button onClick={() => setEditing({ type: 'cliente', is_active: true })}>
                <Plus className="h-4 w-4" /> Novo contato
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 max-w-xs">
        <Input placeholder="Buscar por nome ou documento…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">Nenhum contato encontrado.</p>
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nome</TH>
                  <TH>Tipo</TH>
                  <TH>Documento</TH>
                  <TH>Contato</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>
                      <Badge variant="secondary">{TYPES.find((t) => t.value === c.type)?.label}</Badge>
                    </TD>
                    <TD>{formatDocument(c.document)}</TD>
                    <TD className="text-sm text-muted-foreground">{c.email || c.phone || '—'}</TD>
                    <TD className="text-right">
                      {canWrite && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar contato' : 'Novo contato'}>
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(editing)
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={editing.type ?? 'cliente'}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as ContactType })}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ / CPF</Label>
                <div className="flex gap-2">
                  <Input
                    value={editing.document ?? ''}
                    onChange={(e) => setEditing({ ...editing, document: e.target.value })}
                    onBlur={(e) => lookupCNPJ(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Buscar dados pelo CNPJ"
                    onClick={() => lookupCNPJ(editing.document ?? '')}
                    disabled={cnpjLoading || !isCNPJ(editing.document ?? '')}
                  >
                    {cnpjLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {cnpjMsg && <p className="text-xs text-muted-foreground">{cnpjMsg}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
            </div>

            {/* Dados bancários / PIX */}
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">Dados bancários / PIX</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de chave PIX</Label>
                  <Select value={bank.pix_tipo ?? ''} onChange={(e) => setBank({ pix_tipo: e.target.value })}>
                    <option value="">—</option>
                    {PIX_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Chave PIX</Label>
                  <Input uppercase={false} value={bank.pix_chave ?? ''} onChange={(e) => setBank({ pix_chave: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Tipo de conta</Label>
                  <Select value={bank.tipo_conta ?? ''} onChange={(e) => setBank({ tipo_conta: e.target.value })}>
                    <option value="">—</option>
                    {TIPOS_CONTA.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Agência</Label>
                  <Input value={bank.agencia ?? ''} onChange={(e) => setBank({ agencia: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Conta</Label>
                  <Input value={bank.conta ?? ''} onChange={(e) => setBank({ conta: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
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
