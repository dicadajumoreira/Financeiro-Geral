import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Building2, Trash2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { formatCNPJ } from '@/lib/format'
import { fetchCNPJ, isCNPJ } from '@/lib/finance/cnpj'
import type { Company } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageLoader, Spinner } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']

export default function Empresas() {
  const { org, role, canWrite, currentCompany, setCurrentCompany, refresh } = useOrg()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Company> | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null)
  // Exclusão (destrutiva, em cascata) restrita a owner/admin.
  const canDelete = role === 'owner' || role === 'admin'

  // Consulta o CNPJ e preenche os demais campos automaticamente.
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
              legal_name: prev.legal_name || d.razaoSocial,
              trade_name: prev.trade_name || d.nomeFantasia || d.razaoSocial,
              email: prev.email || d.email,
              phone: prev.phone || d.telefone,
              tax_regime: prev.tax_regime || d.taxRegime || '',
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

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*')
      if (error) throw error
      // Ordem alfabética sempre pelo nome exibido (fantasia ou razão social).
      return (data as Company[]).sort((a, b) =>
        (a.trade_name || a.legal_name).localeCompare(b.trade_name || b.legal_name, 'pt-BR', {
          sensitivity: 'base',
        }),
      )
    },
    enabled: !!org,
  })

  const save = useMutation({
    mutationFn: async (form: Partial<Company>) => {
      const payload = {
        org_id: org!.id,
        legal_name: form.legal_name!,
        trade_name: form.trade_name || null,
        cnpj: form.cnpj || null,
        tax_regime: form.tax_regime || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address ?? null,
        is_active: form.is_active ?? true,
      }
      if (form.id) {
        const { error } = await supabase.from('companies').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('companies').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await refresh()
    },
  })

  const remove = useMutation({
    mutationFn: async (company: Company) => {
      // O ON DELETE CASCADE remove lançamentos, plano de contas, contas, etc.
      const { error } = await supabase.from('companies').delete().eq('id', company.id)
      if (error) throw error
    },
    onSuccess: async (_data, company) => {
      if (currentCompany?.id === company.id) setCurrentCompany(null)
      setDeleting(null)
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await refresh()
    },
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Cadastro das empresas (CNPJs) gerenciadas pela sua organização."
        actions={
          canWrite && (
            <Button onClick={() => setEditing({ is_active: true })}>
              <Plus className="h-4 w-4" /> Nova empresa
            </Button>
          )
        }
      />

      {companies && companies.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Empresa</TH>
                  <TH>CNPJ</TH>
                  <TH>Regime</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {companies.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <div className="font-medium">{c.trade_name || c.legal_name}</div>
                      {c.trade_name && <div className="text-xs text-muted-foreground">{c.legal_name}</div>}
                    </TD>
                    <TD>{formatCNPJ(c.cnpj)}</TD>
                    <TD>{c.tax_regime || '—'}</TD>
                    <TD>
                      {c.is_active ? (
                        <Badge variant="success">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(c)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState onCreate={canWrite ? () => setEditing({ is_active: true }) : undefined} />
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar empresa' : 'Nova empresa'}
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate(editing)
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Razão social *</Label>
              <Input
                value={editing.legal_name ?? ''}
                onChange={(e) => setEditing({ ...editing, legal_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome fantasia</Label>
              <Input
                value={editing.trade_name ?? ''}
                onChange={(e) => setEditing({ ...editing, trade_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CNPJ</Label>
                <div className="flex gap-2">
                  <Input
                    value={editing.cnpj ?? ''}
                    onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })}
                    onBlur={(e) => lookupCNPJ(e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Buscar dados pelo CNPJ"
                    onClick={() => lookupCNPJ(editing.cnpj ?? '')}
                    disabled={cnpjLoading || !isCNPJ(editing.cnpj ?? '')}
                  >
                    {cnpjLoading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {cnpjMsg && <p className="text-xs text-muted-foreground">{cnpjMsg}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Regime tributário</Label>
                <Select
                  value={editing.tax_regime ?? ''}
                  onChange={(e) => setEditing({ ...editing, tax_regime: e.target.value })}
                >
                  <option value="">—</option>
                  {REGIMES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editing.email ?? ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={editing.phone ?? ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
              />
              Empresa ativa
            </label>
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

      {/* Confirmação de exclusão (destrutiva, em cascata) */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Excluir empresa">
        {deleting && (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Esta ação é permanente e não pode ser desfeita.</p>
              <p className="mt-1 text-muted-foreground">
                Excluir <strong>{deleting.trade_name || deleting.legal_name}</strong> remove também, em cascata,
                <strong> todos os lançamentos, plano de contas, centros de custo, contas bancárias, recorrências e anexos</strong> desta empresa.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Se quiser apenas parar de usá-la, considere marcá-la como <strong>inativa</strong> em vez de excluir.
            </p>
            {remove.isError && <p className="text-sm text-destructive">{(remove.error as Error).message}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={() => remove.mutate(deleting)} disabled={remove.isPending}>
                {remove.isPending ? 'Excluindo…' : 'Excluir definitivamente'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-medium">Nenhuma empresa cadastrada</p>
          <p className="text-sm text-muted-foreground">Cadastre sua primeira empresa para começar.</p>
        </div>
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
