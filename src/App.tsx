import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useOrg } from '@/contexts/OrgContext'
import { PageLoader } from '@/components/ui/spinner'
import { AppLayout } from '@/components/layout/AppLayout'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import Onboarding from '@/pages/Onboarding'
import Dashboard from '@/pages/Dashboard'
import Empresas from '@/pages/Empresas'
import PlanoDeContas from '@/pages/PlanoDeContas'
import Contatos from '@/pages/Contatos'
import ContasBancarias from '@/pages/ContasBancarias'
import Lancamentos from '@/pages/Lancamentos'
import Recorrencias from '@/pages/Recorrencias'
import FluxoDeCaixa from '@/pages/FluxoDeCaixa'
import Dre from '@/pages/Dre'
import Configuracoes from '@/pages/Configuracoes'
import EmBreve from '@/pages/EmBreve'

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
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
      <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" replace />} />

      <Route element={<ProtectedShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lancamentos" element={<Lancamentos />} />
        <Route path="/recorrencias" element={<Recorrencias />} />
        <Route path="/fluxo-de-caixa" element={<FluxoDeCaixa />} />
        <Route path="/dre" element={<Dre />} />
        <Route path="/empresas" element={<Empresas />} />
        <Route path="/plano-de-contas" element={<PlanoDeContas />} />
        <Route path="/contatos" element={<Contatos />} />
        <Route path="/contas-bancarias" element={<ContasBancarias />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/conciliacao" element={<EmBreve titulo="Conciliação Bancária" fase="Fase 2" />} />
        <Route path="/funcionarios" element={<EmBreve titulo="Funcionários & Encargos" fase="Fase 3" />} />
        <Route path="/crm" element={<EmBreve titulo="CRM Comercial" fase="Fase 4" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
