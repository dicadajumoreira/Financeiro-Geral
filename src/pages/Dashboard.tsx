import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useOrg } from '@/contexts/OrgContext'
import { useTransactions } from '@/hooks/useTransactions'
import { formatBRL, formatDate, todayISO } from '@/lib/format'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoader } from '@/components/ui/spinner'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'

export default function Dashboard() {
  const { currentCompany } = useOrg()
  const { data: txs, isLoading } = useTransactions()

  const stats = useMemo(() => {
    const now = new Date()
    const monthKey = format(now, 'yyyy-MM')
    const today = todayISO()
    let recMes = 0
    let despMes = 0
    let aReceber = 0
    let aPagar = 0
    let atrasado = 0

    for (const t of txs ?? []) {
      const isMonth = t.competence_date?.startsWith(monthKey)
      if (isMonth) {
        if (t.kind === 'receita') recMes += Number(t.amount)
        else despMes += Number(t.amount)
      }
      const pending = t.status === 'pendente' || t.status === 'parcial' || t.status === 'atrasado'
      if (pending) {
        if (t.kind === 'receita') aReceber += Number(t.amount)
        else aPagar += Number(t.amount)
        if (t.due_date < today) atrasado += Number(t.amount)
      }
    }
    return { recMes, despMes, saldoMes: recMes - despMes, aReceber, aPagar, atrasado }
  }, [txs])

  const chartData = useMemo(() => {
    const months: { key: string; label: string; receitas: number; despesas: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i))
      months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM/yy', { locale: ptBR }), receitas: 0, despesas: 0 })
    }
    const map = new Map(months.map((m) => [m.key, m]))
    for (const t of txs ?? []) {
      const k = t.competence_date?.slice(0, 7)
      const m = k ? map.get(k) : undefined
      if (!m) continue
      if (t.kind === 'receita') m.receitas += Number(t.amount)
      else m.despesas += Number(t.amount)
    }
    return months
  }, [txs])

  const upcoming = useMemo(
    () =>
      (txs ?? [])
        .filter((t) => (t.status === 'pendente' || t.status === 'atrasado') )
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 8),
    [txs],
  )

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={currentCompany ? currentCompany.trade_name || currentCompany.legal_name : 'Visão consolidada de todas as empresas'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Receitas do mês" value={formatBRL(stats.recMes)} icon={TrendingUp} tone="success" />
        <StatCard title="Despesas do mês" value={formatBRL(stats.despMes)} icon={TrendingDown} tone="destructive" />
        <StatCard title="Resultado do mês" value={formatBRL(stats.saldoMes)} icon={Wallet} tone={stats.saldoMes >= 0 ? 'success' : 'destructive'} />
        <StatCard title="Vencido em aberto" value={formatBRL(stats.atrasado)} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receitas x Despesas (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Em aberto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="A receber" value={formatBRL(stats.aReceber)} tone="success" icon={Clock} />
            <Row label="A pagar" value={formatBRL(stats.aPagar)} tone="destructive" icon={Clock} />
            <div className="border-t border-border pt-3">
              <Row label="Saldo projetado" value={formatBRL(stats.aReceber - stats.aPagar)} tone={stats.aReceber - stats.aPagar >= 0 ? 'success' : 'destructive'} icon={Wallet} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Próximos vencimentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {upcoming.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Nada em aberto. 🎉</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Vencimento</TH>
                  <TH>Descrição</TH>
                  {!currentCompany && <TH>Empresa</TH>}
                  <TH className="text-right">Valor</TH>
                </TR>
              </THead>
              <TBody>
                {upcoming.map((t) => {
                  const overdue = t.due_date < todayISO()
                  return (
                    <TR key={t.id}>
                      <TD className="whitespace-nowrap">
                        {formatDate(t.due_date)}{' '}
                        {overdue && <Badge variant="destructive">vencido</Badge>}
                      </TD>
                      <TD className="font-medium">{t.description}</TD>
                      {!currentCompany && (
                        <TD className="text-sm text-muted-foreground">{t.companies?.trade_name || t.companies?.legal_name}</TD>
                      )}
                      <TD className={`text-right tabular-nums ${t.kind === 'receita' ? 'text-success' : 'text-destructive'}`}>
                        {t.kind === 'receita' ? '+' : '−'} {formatBRL(t.amount)}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const TONES = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  default: 'text-foreground',
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  icon: typeof Wallet
  tone: keyof typeof TONES
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${TONES[tone]}`}>{value}</p>
        </div>
        <Icon className={`h-8 w-8 opacity-70 ${TONES[tone]}`} />
      </CardContent>
    </Card>
  )
}

function Row({ label, value, tone, icon: Icon }: { label: string; value: string; tone: keyof typeof TONES; icon: typeof Wallet }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className={`font-semibold tabular-nums ${TONES[tone]}`}>{value}</span>
    </div>
  )
}
