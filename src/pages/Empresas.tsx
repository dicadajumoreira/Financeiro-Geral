import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { formatCNPJ } from '@/lib/format'
import type { Company } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const REGIMES = ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'MEI']

export default function Empresas() {
  const { org, canWrite, refresh } = useOrg()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Company> | null>(null)

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
                <Input
                  value={editing.cnpj ?? ''}
                  onChange={(e) => setEditing({ ...editing, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
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
