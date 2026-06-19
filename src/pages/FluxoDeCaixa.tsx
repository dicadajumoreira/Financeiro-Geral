import { useMemo, useState } from 'react'
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useOrg } from '@/contexts/OrgContext'
import { useTransactions } from '@/hooks/useTransactions'
import { formatBRL } from '@/lib/format'
import { PageHeader } from '@/components/layout/PageHeader'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageLoader } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
type Basis = 'caixa' | 'competencia'

export default function FluxoDeCaixa() {
  const { currentCompany } = useOrg()
  const { data: txs, isLoading } = useTransactions()
  const [year, setYear] = useState(new Date().getFullYear())
  const [basis, setBasis] = useState<Basis>('caixa')

  const rows = useMemo(() => {
    const months = MONTHS.map((label, i) => ({ i, label, entradas: 0, saidas: 0 }))
    for (const t of txs ?? []) {
      // Regime de caixa: usa a data de pagamento (se houver); senão, o vencimento previsto.
      const dateStr = basis === 'caixa' ? t.payment_date ?? t.due_date : t.competence_date
      if (!dateStr) continue
      const d = new Date(dateStr + 'T00:00:00')
      if (d.getFullYear() !== year) continue
      // No regime de caixa só conta o que foi efetivamente pago/recebido OU o previsto não pago.
      const m = months[d.getMonth()]
      if (t.kind === 'receita') m.entradas += Number(t.amount)
      else m.saidas += Number(t.amount)
    }
    let acc = 0
    return months.map((m) => {
      const saldo = m.entradas - m.saidas
      acc += saldo
      return { ...m, saldo, acumulado: acc }
    })
  }, [txs, year, basis])

  const totals = useMemo(
    () => rows.reduce((a, r) => ({ entradas: a.entradas + r.entradas, saidas: a.saidas + r.saidas }), { entradas: 0, saidas: 0 }),
    [rows],
  )

  if (isLoading) return <PageLoader />
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  return (
    <div>
      <PageHeader
        title="Fluxo de Caixa"
        description={currentCompany ? currentCompany.trade_name || currentCompany.legal_name : 'Consolidado de todas as empresas'}
        actions={
          <div className="flex gap-2">
            <Select value={basis} onChange={(e) => setBasis(e.target.value as Basis)} className="max-w-[170px]">
              <option value="caixa">Regime de caixa</option>
              <option value="competencia">Regime de competência</option>
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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Saldo acumulado em {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Mês</TH>
                <TH className="text-right">Entradas</TH>
                <TH className="text-right">Saídas</TH>
                <TH className="text-right">Saldo do mês</TH>
                <TH className="text-right">Acumulado</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.i}>
                  <TD className="font-medium">{r.label}</TD>
                  <TD className="text-right tabular-nums text-success">{formatBRL(r.entradas)}</TD>
                  <TD className="text-right tabular-nums text-destructive">{formatBRL(r.saidas)}</TD>
                  <TD className={`text-right tabular-nums ${r.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>{formatBRL(r.saldo)}</TD>
                  <TD className="text-right font-medium tabular-nums">{formatBRL(r.acumulado)}</TD>
                </TR>
              ))}
              <TR className="bg-muted/50 font-semibold">
                <TD>Total</TD>
                <TD className="text-right tabular-nums text-success">{formatBRL(totals.entradas)}</TD>
                <TD className="text-right tabular-nums text-destructive">{formatBRL(totals.saidas)}</TD>
                <TD className="text-right tabular-nums">{formatBRL(totals.entradas - totals.saidas)}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
