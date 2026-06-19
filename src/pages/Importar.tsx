import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOrg } from '@/contexts/OrgContext'
import { useAuth } from '@/contexts/AuthContext'
import { formatBRL } from '@/lib/format'
import { CHART_TEMPLATE } from '@/lib/finance/chartTemplate'
import { buildParsedRows, readExpenseFile, type ParsedRow } from '@/lib/finance/importParser'
import type { ChartAccount } from '@/types/database'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

export default function Importar() {
  const { org, companies, canWrite, refresh } = useOrg()
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  // Categorias (despesa) de todas as empresas, para os selects de revisão.
  const { data: accounts, refetch: refetchAccounts } = useQuery({
    queryKey: ['coa-all', org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, company_id, name, type')
        .eq('type', 'despesa')
      if (error) throw error
      return data as Pick<ChartAccount, 'id' | 'company_id' | 'name' | 'type'>[]
    },
    enabled: !!org,
  })

  const accountsByCompany = useMemo(() => {
    const map = new Map<string, Pick<ChartAccount, 'id' | 'company_id' | 'name' | 'type'>[]>()
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
    const found = list.find((a) => a.name.toUpperCase() === categoryName.toUpperCase())
    return found?.id ?? null
  }

  async function handleFile(file: File) {
    setError(null)
    setDone(null)
    try {
      const buf = await file.arrayBuffer()
      const raws = readExpenseFile(buf)
      if (raws.length === 0) {
        setError('Não encontrei linhas de despesa. Verifique se a planilha tem as colunas Descrição e Valor.')
        return
      }
      setRows(buildParsedRows(raws, companies))
      setFileName(file.name)
    } catch (e) {
      setError(`Falha ao ler o arquivo: ${(e as Error).message}`)
    }
  }

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
      const toImport = rows.filter((r) => r.include && r.companyId && r.valor > 0 && (r.dueDate || r.paymentDate))
      const payload = toImport.map((r) => {
        const baseDate = r.dueDate || r.paymentDate!
        return {
          org_id: org!.id,
          company_id: r.companyId!,
          kind: 'despesa' as const,
          description: r.descricao,
          amount: r.valor,
          account_id: resolveAccountId(r.companyId, r.categoryName),
          competence_date: baseDate,
          due_date: baseDate,
          payment_date: r.status === 'pago' ? r.paymentDate : null,
          status: r.status,
          created_by: user?.id ?? null,
        }
      })
      // Insere em lotes
      for (let i = 0; i < payload.length; i += 200) {
        const chunk = payload.slice(i, i + 200)
        const { error } = await supabase.from('transactions').insert(chunk)
        if (error) throw error
      }
      return payload.length
    },
    onSuccess: async (count) => {
      setDone(count)
      setRows([])
      setFileName('')
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await refresh()
    },
    onError: (e) => setError((e as Error).message),
  })

  const stats = useMemo(() => {
    const incl = rows.filter((r) => r.include)
    return {
      total: rows.length,
      incl: incl.length,
      semEmpresa: incl.filter((r) => !r.companyId).length,
      valor: incl.reduce((s, r) => s + r.valor, 0),
    }
  }, [rows])

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
        description="Suba sua planilha (.xlsx ou .csv). Detecto empresa e categoria automaticamente; você revisa antes de salvar."
      />

      {/* Upload */}
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
            Dica: no Google Sheets use Arquivo → Fazer download → .xlsx (importa todas as abas/meses de uma vez).
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

      {rows.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{stats.incl}/{stats.total} selecionados</Badge>
            <span className="text-muted-foreground">Total: <strong className="text-foreground">{formatBRL(stats.valor)}</strong></span>
            {stats.semEmpresa > 0 && (
              <Badge variant="warning">{stats.semEmpresa} sem empresa definida</Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => seedAll.mutate()} disabled={seedAll.isPending} title="Cria as categorias padrão nas empresas que ainda não têm">
                {seedAll.isPending ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Criar categorias nas empresas
              </Button>
              <Button size="sm" onClick={() => importMut.mutate()} disabled={importMut.isPending || stats.incl === 0}>
                {importMut.isPending ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Importar {stats.incl} selecionados
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
                    <TH>Categoria</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((r, idx) => {
                    const opts = r.companyId ? accountsByCompany.get(r.companyId) ?? [] : []
                    const selectedAccount = resolveAccountId(r.companyId, r.categoryName)
                    return (
                      <TR key={r.id} className={!r.include ? 'opacity-40' : undefined}>
                        <TD>
                          <input
                            type="checkbox"
                            checked={r.include}
                            onChange={(e) => updateRow(setRows, idx, { include: e.target.checked })}
                          />
                        </TD>
                        <TD className="whitespace-nowrap text-xs text-muted-foreground">{r.raw.sheet}</TD>
                        <TD className="min-w-[220px] font-medium">{r.descricao}</TD>
                        <TD className="text-right tabular-nums">{formatBRL(r.valor)}</TD>
                        <TD className="whitespace-nowrap text-sm">{r.dueDate || r.paymentDate || '—'}</TD>
                        <TD>
                          <Select
                            value={r.companyId ?? ''}
                            onChange={(e) => updateRow(setRows, idx, { companyId: e.target.value || null })}
                            className={`h-8 min-w-[150px] ${!r.companyId ? 'border-warning' : ''}`}
                          >
                            <option value="">— escolher —</option>
                            {companies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.trade_name || c.legal_name}
                              </option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <Select
                            value={selectedAccount ?? ''}
                            onChange={(e) => {
                              const acc = opts.find((a) => a.id === e.target.value)
                              updateRow(setRows, idx, { categoryName: acc?.name ?? r.categoryName })
                            }}
                            className="h-8 min-w-[160px]"
                            disabled={!r.companyId}
                          >
                            <option value="">{r.categoryName} (criar p/ vincular)</option>
                            {opts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </Select>
                        </TD>
                        <TD>
                          <Select
                            value={r.status}
                            onChange={(e) => updateRow(setRows, idx, { status: e.target.value as ParsedRow['status'] })}
                            className="h-8 min-w-[110px]"
                          >
                            <option value="pago">Pago</option>
                            <option value="pendente">Pendente</option>
                          </Select>
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
    </div>
  )
}

function updateRow(setRows: React.Dispatch<React.SetStateAction<ParsedRow[]>>, idx: number, patch: Partial<ParsedRow>) {
  setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
}
