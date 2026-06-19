import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle2, Sparkles, AlertTriangle, X, Repeat } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatBRL, formatMonthYear } from '@/lib/format'
import { CHART_TEMPLATE } from '@/lib/finance/chartTemplate'
import {
  buildParsedRows,
  readExpenseFile,
  detectRecurrenceCandidates,
  type LearnedClassification,
  type ParsedRow,
  type RecurrenceCandidate,
} from '@/lib/finance/importParser'
import type { ChartAccount, Contact, ImportClassification, RecurrenceFrequency } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { cn } from '@/lib/utils'

type AccountLite = Pick<ChartAccount, 'id' | 'company_id' | 'name' | 'type'>

interface RecDialogState {
  candidate: RecurrenceCandidate
  frequency: RecurrenceFrequency
  term: 'indeterminado' | 'determinado'
  mode: 'data' | 'ocorrencias'
  endDate: string
  occurrences: string
}

export default function Importar() {
  const { org, companies, canWrite, refresh } = useOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [months, setMonths] = useState<Set<string>>(new Set())
  const [candidates, setCandidates] = useState<RecurrenceCandidate[]>([])
  const [recDialog, setRecDialog] = useState<RecDialogState | null>(null)

  // Categorias (despesa) de todas as empresas, para os selects de revisão.
  const { data: accounts, refetch: refetchAccounts } = useQuery({
    queryKey: ['coa-all', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, company_id, name, type')
        .eq('type', 'despesa')
      if (error) throw error
      return data as AccountLite[]
    },
    enabled: !!org,
  })

  // Fornecedores cadastrados (para detectar/vincular nas despesas).
  const { data: contacts } = useQuery({
    queryKey: ['contacts', org?.id],
    queryFn: async () => (await supabase.from('contacts').select('*').order('name')).data as Contact[],
    enabled: !!org,
  })
  const fornecedores = useMemo(
    () => (contacts ?? []).filter((c) => c.type === 'fornecedor' || c.type === 'ambos'),
    [contacts],
  )

  // Classificações aprendidas (memória de importações anteriores).
  const { data: learned } = useQuery({
    queryKey: ['import-classifications', org?.id],
    queryFn: async () => {
      const map = new Map<string, LearnedClassification>()
      try {
        const { data, error } = await supabase
          .from('import_classifications')
          .select('pattern, company_id, contact_id, category_name, status')
        if (error) throw error
        for (const r of (data ?? []) as ImportClassification[]) {
          map.set(r.pattern, {
            company_id: r.company_id,
            contact_id: r.contact_id ?? null,
            category_name: r.category_name,
            status: r.status,
          })
        }
      } catch {
        // Tabela ainda não criada (migração 0003/0004 pendente): segue sem memória.
      }
      return map
    },
    enabled: !!org,
  })

  const accountsByCompany = useMemo(() => {
    const map = new Map<string, AccountLite[]>()
    for (const a of accounts ?? []) {
      const list = map.get(a.company_id) ?? []
      list.push(a)
      map.set(a.company_id, list)
    }
    return map
  }, [accounts])

  function resolveAccountId(companyId: string | null, categoryName: string): string | null {
    if (!companyId) return null
    const list = accountsByCompany.get(companyId) ?? []
    return list.find((a) => a.name.toUpperCase() === categoryName.toUpperCase())?.id ?? null
  }

  async function handleFile(file: File) {
    setError(null)
    setDone(null)
    setCandidates([])
    try {
      const buf = await file.arrayBuffer()
      const raws = readExpenseFile(buf)
      if (raws.length === 0) {
        setError('Não encontrei linhas de despesa. Verifique se a planilha tem as colunas Descrição e Valor.')
        return
      }
      const parsed = buildParsedRows(raws, companies, learned, contacts ?? [])
      setRows(parsed)
      setFileName(file.name)
      // Pergunta o mês: por padrão seleciona todos os meses encontrados.
      setMonths(new Set(parsed.map((r) => r.monthKey).filter(Boolean)))
    } catch (e) {
      setError(`Falha ao ler o arquivo: ${(e as Error).message}`)
    }
  }

  const allMonths = useMemo(
    () => [...new Set(rows.map((r) => r.monthKey).filter(Boolean))].sort(),
    [rows],
  )

  // Linhas visíveis = dentro dos meses selecionados.
  const visibleRows = useMemo(
    () => rows.filter((r) => !r.monthKey || months.has(r.monthKey)),
    [rows, months],
  )

  // Cria o plano de contas padrão nas empresas que ainda não têm categorias.
  const seedAll = useMutation({
    mutationFn: async () => {
      const toSeed = companies.filter((c) => (accountsByCompany.get(c.id)?.length ?? 0) === 0)
      const payload = toSeed.flatMap((c) =>
        CHART_TEMPLATE.map((t) => ({ org_id: org!.id, company_id: c.id, name: t.name, type: t.type, dre_group: t.dre_group })),
      )
      if (payload.length) {
        const { error } = await supabase.from('chart_of_accounts').insert(payload)
        if (error) throw error
      }
      return toSeed.length
    },
    onSuccess: async () => {
      await refetchAccounts()
    },
  })

  const importMut = useMutation({
    mutationFn: async () => {
      const toImport = visibleRows.filter((r) => r.include && r.companyId && r.valor > 0 && (r.dueDate || r.paymentDate))
      const payload = toImport.map((r) => {
        const baseDate = r.dueDate || r.paymentDate!
        return {
          org_id: org!.id,
          company_id: r.companyId!,
          kind: 'despesa' as const,
          description: r.descricao,
          amount: r.valor,
          account_id: resolveAccountId(r.companyId, r.categoryName),
          contact_id: r.contactId,
          competence_date: baseDate,
          due_date: baseDate,
          payment_date: r.status === 'pago' ? r.paymentDate : null,
          status: r.status,
          created_by: user?.id ?? null,
        }
      })
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await supabase.from('transactions').insert(payload.slice(i, i + 200))
        if (error) throw error
      }

      // Aprende as classificações (descrição → empresa/categoria/status).
      try {
        const byPattern = new Map<string, Partial<ImportClassification>>()
        for (const r of toImport) {
          if (!r.pattern) continue
          byPattern.set(r.pattern, {
            org_id: org!.id,
            pattern: r.pattern,
            company_id: r.companyId,
            contact_id: r.contactId,
            category_name: r.categoryName,
            status: r.status,
          })
        }
        const learnRows = [...byPattern.values()]
        if (learnRows.length) {
          await supabase.from('import_classifications').upsert(learnRows, { onConflict: 'org_id,pattern' })
        }
      } catch {
        // memória indisponível (migração pendente) — ignora
      }

      return { count: payload.length, candidates: detectRecurrenceCandidates(toImport) }
    },
    onSuccess: async ({ count, candidates }) => {
      setDone(count)
      setRows([])
      setFileName('')
      setCandidates(candidates)
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['tx-report'] })
      await qc.invalidateQueries({ queryKey: ['import-classifications'] })
      await refresh()
    },
    onError: (e) => setError((e as Error).message),
  })

  // Cria a recorrência a partir de uma sugestão.
  const createRec = useMutation({
    mutationFn: async (s: RecDialogState) => {
      const startDate = `${s.candidate.months[0]}-01`
      const payload = {
        org_id: org!.id,
        company_id: s.candidate.companyId!,
        kind: 'despesa' as const,
        description: s.candidate.descricao,
        amount: s.candidate.valor,
        account_id: resolveAccountId(s.candidate.companyId, s.candidate.categoryName),
        frequency: s.frequency,
        start_date: startDate,
        end_date: s.term === 'determinado' && s.mode === 'data' && s.endDate ? s.endDate : null,
        occurrences: s.term === 'determinado' && s.mode === 'ocorrencias' && s.occurrences ? Number(s.occurrences) : null,
        is_active: true,
      }
      const { error } = await supabase.from('recurrences').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      const done = recDialog?.candidate.pattern
      setRecDialog(null)
      setCandidates((prev) => prev.filter((c) => c.pattern !== done))
      await qc.invalidateQueries({ queryKey: ['recurrences'] })
    },
  })

  const stats = useMemo(() => {
    const incl = visibleRows.filter((r) => r.include)
    return {
      total: visibleRows.length,
      incl: incl.length,
      semEmpresa: incl.filter((r) => !r.companyId).length,
      valor: incl.reduce((s, r) => s + r.valor, 0),
    }
  }, [visibleRows])

  function companyName(id: string | null) {
    const c = companies.find((x) => x.id === id)
    return c ? c.trade_name || c.legal_name : '—'
  }

  if (!canWrite) {
    return (
      <div>
        <PageHeader title="Importar despesas" />
        <Card><CardContent className="py-10 text-center text-muted-foreground">Você não tem permissão para importar.</CardContent></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Importar despesas"
        description="Suba sua planilha (.xlsx ou .csv). Detecto empresa e categoria automaticamente, aprendo suas classificações e sugiro recorrências."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-5">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Escolher arquivo
          </Button>
          {fileName && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> {fileName}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Dica: no Google Sheets use Arquivo → Fazer download → .xlsx (lê todas as abas/meses de uma vez).
          </span>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </CardContent>
        </Card>
      )}

      {done !== null && (
        <Card className="mb-4 border-success/40">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {done} lançamento(s) importado(s) com sucesso! Veja em Lançamentos.
          </CardContent>
        </Card>
      )}

      {/* Sugestões de recorrência após a importação */}
      {candidates.length > 0 && (
        <Card className="mb-4 border-primary/40">
          <CardContent className="py-4">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Repeat className="h-4 w-4 text-primary" /> Despesas que se repetem todo mês — transformar em recorrência?
            </div>
            <div className="space-y-2">
              {candidates.map((c) => (
                <div key={c.pattern + c.companyId} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <span className="font-medium">{c.descricao}</span>
                  <Badge variant="secondary">{companyName(c.companyId)}</Badge>
                  <span className="text-muted-foreground">{formatBRL(c.valor)}</span>
                  <Badge variant="outline">{c.months.length} meses</Badge>
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() =>
                      setRecDialog({ candidate: c, frequency: 'mensal', term: 'indeterminado', mode: 'ocorrencias', endDate: '', occurrences: '' })
                    }
                  >
                    <Repeat className="h-4 w-4" /> Criar recorrência
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          {/* Pergunta o mês de importação */}
          {allMonths.length > 0 && (
            <Card className="mb-3">
              <CardContent className="flex flex-wrap items-center gap-2 py-3">
                <span className="text-sm font-medium">Meses a importar:</span>
                {allMonths.map((m) => {
                  const on = months.has(m)
                  return (
                    <button
                      key={m}
                      onClick={() =>
                        setMonths((prev) => {
                          const next = new Set(prev)
                          if (next.has(m)) next.delete(m)
                          else next.add(m)
                          return next
                        })
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
                        on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                      )}
                    >
                      {monthLabel(m)}
                    </button>
                  )
                })}
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMonths(new Set(allMonths))}>Todos</Button>
                  <Button variant="ghost" size="sm" onClick={() => setMonths(new Set())}>Nenhum</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{stats.incl}/{stats.total} selecionados</Badge>
            <span className="text-muted-foreground">Total: <strong className="text-foreground">{formatBRL(stats.valor)}</strong></span>
            {stats.semEmpresa > 0 && <Badge variant="warning">{stats.semEmpresa} sem empresa</Badge>}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => seedAll.mutate()} disabled={seedAll.isPending} title="Cria categorias padrão nas empresas que ainda não têm">
                {seedAll.isPending ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Criar categorias
              </Button>
              <Button size="sm" onClick={() => importMut.mutate()} disabled={importMut.isPending || stats.incl === 0}>
                {importMut.isPending ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Importar {stats.incl}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-8"></TH>
                    <TH>Mês</TH>
                    <TH>Descrição</TH>
                    <TH className="text-right">Valor</TH>
                    <TH>Data</TH>
                    <TH>Empresa</TH>
                    <TH>Fornecedor</TH>
                    <TH>Categoria</TH>
                    <TH>Status</TH>
                    <TH className="w-8"></TH>
                  </TR>
                </THead>
                <TBody>
                  {visibleRows.map((r) => {
                    const opts = r.companyId ? accountsByCompany.get(r.companyId) ?? [] : []
                    const selectedAccount = resolveAccountId(r.companyId, r.categoryName)
                    return (
                      <TR key={r.id} className={!r.include ? 'opacity-40' : undefined}>
                        <TD>
                          <input type="checkbox" checked={r.include} onChange={(e) => updateRow(setRows, r.id, { include: e.target.checked })} />
                        </TD>
                        <TD className="whitespace-nowrap text-xs capitalize text-muted-foreground">{r.monthKey ? monthLabel(r.monthKey) : r.raw.sheet}</TD>
                        <TD className="min-w-[200px] font-medium">{r.descricao}</TD>
                        <TD className="text-right tabular-nums">{formatBRL(r.valor)}</TD>
                        <TD className="whitespace-nowrap text-sm">{r.dueDate || r.paymentDate || '—'}</TD>
                        <TD>
                          <Select
                            value={r.companyId ?? ''}
                            onChange={(e) => updateRow(setRows, r.id, { companyId: e.target.value || null })}
                            className={cn('h-8 min-w-[140px]', !r.companyId && 'border-warning')}
                          >
                            <option value="">— escolher —</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>{c.trade_name || c.legal_name}</option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <Select
                            value={r.contactId ?? ''}
                            onChange={(e) => updateRow(setRows, r.id, { contactId: e.target.value || null })}
                            className="h-8 min-w-[150px]"
                          >
                            <option value="">— fornecedor —</option>
                            {fornecedores.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <Select
                            value={selectedAccount ?? ''}
                            onChange={(e) => {
                              const acc = opts.find((a) => a.id === e.target.value)
                              updateRow(setRows, r.id, { categoryName: acc?.name ?? r.categoryName })
                            }}
                            className="h-8 min-w-[150px]"
                            disabled={!r.companyId}
                          >
                            <option value="">{r.categoryName} (criar p/ vincular)</option>
                            {opts.map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <Select
                            value={r.status}
                            onChange={(e) => updateRow(setRows, r.id, { status: e.target.value as ParsedRow['status'] })}
                            className="h-8 min-w-[100px]"
                          >
                            <option value="pago">Pago</option>
                            <option value="pendente">Pendente</option>
                          </Select>
                        </TD>
                        <TD>
                          <Button variant="ghost" size="sm" title="Remover desta importação" onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Diálogo de criação de recorrência */}
      <Dialog open={!!recDialog} onClose={() => setRecDialog(null)} title="Criar recorrência">
        {recDialog && (
          <div className="space-y-4">
            <div className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{recDialog.candidate.descricao}</p>
              <p className="text-muted-foreground">
                {companyName(recDialog.candidate.companyId)} · {formatBRL(recDialog.candidate.valor)} · {recDialog.candidate.months.length} meses
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select value={recDialog.frequency} onChange={(e) => setRecDialog({ ...recDialog, frequency: e.target.value as RecurrenceFrequency })}>
                  <option value="mensal">Mensal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="semanal">Semanal</option>
                  <option value="bimestral">Bimestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <Select value={recDialog.term} onChange={(e) => setRecDialog({ ...recDialog, term: e.target.value as RecDialogState['term'] })}>
                  <option value="indeterminado">Indeterminado (sem fim)</option>
                  <option value="determinado">Determinado</option>
                </Select>
              </div>
            </div>

            {recDialog.term === 'determinado' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Definir por</Label>
                  <Select value={recDialog.mode} onChange={(e) => setRecDialog({ ...recDialog, mode: e.target.value as RecDialogState['mode'] })}>
                    <option value="ocorrencias">Nº de ocorrências</option>
                    <option value="data">Data final</option>
                  </Select>
                </div>
                {recDialog.mode === 'ocorrencias' ? (
                  <div className="space-y-1.5">
                    <Label>Ocorrências</Label>
                    <Input type="number" min={1} value={recDialog.occurrences} onChange={(e) => setRecDialog({ ...recDialog, occurrences: e.target.value })} />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Data final</Label>
                    <Input type="date" value={recDialog.endDate} onChange={(e) => setRecDialog({ ...recDialog, endDate: e.target.value })} />
                  </div>
                )}
              </div>
            )}

            {createRec.isError && <p className="text-sm text-destructive">{(createRec.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRecDialog(null)}>Cancelar</Button>
              <Button type="button" onClick={() => createRec.mutate(recDialog)} disabled={createRec.isPending || !recDialog.candidate.companyId}>
                {createRec.isPending ? 'Criando…' : 'Criar recorrência'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function monthLabel(monthKey: string): string {
  // monthKey = 'YYYY-MM'
  return formatMonthYear(`${monthKey}-01`)
}

function updateRow(setRows: React.Dispatch<React.SetStateAction<ParsedRow[]>>, id: string, patch: Partial<ParsedRow>) {
  setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
}
