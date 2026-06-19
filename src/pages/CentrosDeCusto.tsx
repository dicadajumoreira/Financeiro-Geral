import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Building } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import type { Company, CostCenter } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequireCompany } from '@/components/layout/RequireCompany'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

export default function CentrosDeCusto() {
  return (
    <div>
      <PageHeader title="Centros de Custo" description="Agrupadores para classificar e analisar despesas/receitas por área." />
      <RequireCompany>{(company) => <Inner company={company} />}</RequireCompany>
    </div>
  )
}

function Inner({ company }: { company: Company }) {
  const { org, canWrite } = useOrg()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<CostCenter> | null>(null)

  const { data: items, isLoading } = useQuery({
    queryKey: ['cost_centers', company.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_centers').select('*').eq('company_id', company.id).order('name')
      if (error) throw error
      return data as CostCenter[]
    },
  })

  const save = useMutation({
    mutationFn: async (form: Partial<CostCenter>) => {
      const payload = {
        org_id: org!.id,
        company_id: company.id,
        name: form.name!,
        code: form.code || null,
        is_active: form.is_active ?? true,
      }
      if (form.id) {
        const { error } = await supabase.from('cost_centers').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cost_centers').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['cost_centers', company.id] })
    },
  })

  if (isLoading) return <PageLoader />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {canWrite && (
          <Button onClick={() => setEditing({ is_active: true })}>
            <Plus className="h-4 w-4" /> Novo centro de custo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {items && items.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Código</TH>
                  <TH>Nome</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD className="text-muted-foreground">{c.code || '—'}</TD>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>{c.is_active ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TD>
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
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Building className="h-8 w-8" />
              <p className="text-sm">Nenhum centro de custo cadastrado.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar centro de custo' : 'Novo centro de custo'}>
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.is_active ?? true} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
              Ativo
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
