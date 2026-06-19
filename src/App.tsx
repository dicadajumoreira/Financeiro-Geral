import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import { PageLoader } from '@/components/ui/spinner'
import { AppLayout } from '@/components/layout/AppLayout'

// Páginas de autenticação: carregadas sob demanda
const Login = lazy(() => import('@/pages/auth/Login'))
const Signup = lazy(() => import('@/pages/auth/Signup'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))

// Módulos internos: code-splitting por rota
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Empresas = lazy(() => import('@/pages/Empresas'))
const PlanoDeContas = lazy(() => import('@/pages/PlanoDeContas'))
const CentrosDeCusto = lazy(() => import('@/pages/CentrosDeCusto'))
const Contatos = lazy(() => import('@/pages/Contatos'))
const ImportarFavorecidos = lazy(() => import('@/pages/ImportarFavorecidos'))
const ContasBancarias = lazy(() => import('@/pages/ContasBancarias'))
const Lancamentos = lazy(() => import('@/pages/Lancamentos'))
const Importar = lazy(() => import('@/pages/Importar'))
const Recorrencias = lazy(() => import('@/pages/Recorrencias'))
const FluxoDeCaixa = lazy(() => import('@/pages/FluxoDeCaixa'))
const Dre = lazy(() => import('@/pages/Dre'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const EmBreve = lazy(() => import('@/pages/EmBreve'))

function ProtectedShell() {
  const { loading: authLoading, session } = useAuth()
  const { loading: orgLoading, org } = useOrg()

  if (authLoading || orgLoading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!org) return <Navigate to="/onboarding" replace />
  return <AppLayout />
}

export default function App() {
  const { loading, session } = useAuth()
  if (loading) return <PageLoader />

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
        <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" replace />} />

        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="/recorrencias" element={<Recorrencias />} />
          <Route path="/fluxo-de-caixa" element={<FluxoDeCaixa />} />
          <Route path="/dre" element={<Dre />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/plano-de-contas" element={<PlanoDeContas />} />
          <Route path="/centros-de-custo" element={<CentrosDeCusto />} />
          <Route path="/contatos" element={<Contatos />} />
          <Route path="/importar-favorecidos" element={<ImportarFavorecidos />} />
          <Route path="/contas-bancarias" element={<ContasBancarias />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/conciliacao" element={<EmBreve titulo="Conciliação Bancária" fase="Fase 2" />} />
          <Route path="/funcionarios" element={<EmBreve titulo="Funcionários & Encargos" fase="Fase 3" />} />
          <Route path="/crm" element={<EmBreve titulo="CRM Comercial" fase="Fase 4" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
