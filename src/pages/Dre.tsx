import { useMemo, useState } from 'react'
import { useOrg } from '@/contexts/OrgContext'
import { useTransactions } from '@/hooks/useTransactions'
import { formatBRL } from '@/lib/format'
import { PageHeader } from '@/components/layout/PageHeader'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

// Ordem de exibição dos grupos de DRE (gerencial).
const GROUP_ORDER = [
  'Receita Bruta',
  'Deduções',
  'Custos',
  'Despesas com Pessoal',
  'Despesas Operacionais',
  'Despesas Financeiras',
]

export default function Dre() {
  const { currentCompany } = useOrg()
  const { data: txs, isLoading } = useTransactions()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<number | 'all'>('all')

  const { groups, receitaBruta, totalDespesas, resultado } = useMemo(() => {
    const groupMap = new Map<string, { receita: number; despesa: number }>()
    let receita = 0
    let despesa = 0

    for (const t of txs ?? []) {
      if (!t.competence_date) continue
      const d = new Date(t.competence_date + 'T00:00:00')
      if (d.getFullYear() !== year) continue
      if (month !== 'all' && d.getMonth() !== month) continue

      const group = t.chart_of_accounts?.dre_group || (t.kind === 'receita' ? 'Receita Bruta' : 'Despesas Operacionais')
      const entry = groupMap.get(group) ?? { receita: 0, despesa: 0 }
      if (t.kind === 'receita') {
        entry.receita += Number(t.amount)
        receita += Number(t.amount)
      } else {
        entry.despesa += Number(t.amount)
        despesa += Number(t.amount)
      }
      groupMap.set(group, entry)
    }

    const ordered = [...groupMap.entries()].sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a[0])
      const ib = GROUP_ORDER.indexOf(b[0])
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

    return { groups: ordered, receitaBruta: receita, totalDespesas: despesa, resultado: receita - despesa }
  }, [txs, year, month])

  if (isLoading) return <PageLoader />
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)
  const margem = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0

  return (
    <div>
      <PageHeader
        title="DRE"
        description={`Demonstração de Resultados${currentCompany ? ` — ${currentCompany.trade_name || currentCompany.legal_name}` : ' (consolidado)'} · regime de competência`}
        actions={
          <div className="flex gap-2">
            <Select value={String(month)} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="max-w-[150px]">
              <option value="all">Ano inteiro</option>
              {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="max-w-[110px]">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Summary label="Receita Bruta" value={formatBRL(receitaBruta)} tone="text-success" />
        <Summary label="Total de Custos e Despesas" value={formatBRL(totalDespesas)} tone="text-destructive" />
        <Summary label={`Resultado (${margem.toFixed(1)}%)`} value={formatBRL(resultado)} tone={resultado >= 0 ? 'text-success' : 'text-destructive'} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Grupo</TH>
                <TH className="text-right">Receitas</TH>
                <TH className="text-right">Despesas</TH>
                <TH className="text-right">Resultado</TH>
              </TR>
            </THead>
            <TBody>
              {groups.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="py-10 text-center text-muted-foreground">
                    Sem lançamentos no período. Cadastre lançamentos e associe um Grupo DRE no plano de contas.
                  </TD>
                </TR>
              ) : (
                groups.map(([group, v]) => (
                  <TR key={group}>
                    <TD className="font-medium">{group}</TD>
                    <TD className="text-right tabular-nums text-success">{v.receita ? formatBRL(v.receita) : '—'}</TD>
                    <TD className="text-right tabular-nums text-destructive">{v.despesa ? formatBRL(v.despesa) : '—'}</TD>
                    <TD className={`text-right tabular-nums ${v.receita - v.despesa >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatBRL(v.receita - v.despesa)}
                    </TD>
                  </TR>
                ))
              )}
              <TR className="bg-muted/50 font-semibold">
                <TD>Resultado Líquido</TD>
                <TD className="text-right tabular-nums">{formatBRL(receitaBruta)}</TD>
                <TD className="text-right tabular-nums">{formatBRL(totalDespesas)}</TD>
                <TD className={`text-right tabular-nums ${resultado >= 0 ? 'text-success' : 'text-destructive'}`}>{formatBRL(resultado)}</TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
