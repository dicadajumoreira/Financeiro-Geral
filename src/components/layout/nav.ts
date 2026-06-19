import {
  LayoutDashboard,
  Building2,
  Building,
  ArrowLeftRight,
  Repeat,
  ListTree,
  Users,
  Landmark,
  TrendingUp,
  FileBarChart,
  Target,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Indica funcionalidade ainda não implementada (fases futuras). */
  soon?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: 'Geral',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Lançamentos', to: '/lancamentos', icon: ArrowLeftRight },
      { label: 'Recorrências', to: '/recorrencias', icon: Repeat },
      { label: 'Fluxo de Caixa', to: '/fluxo-de-caixa', icon: TrendingUp },
      { label: 'DRE', to: '/dre', icon: FileBarChart },
      { label: 'Conciliação', to: '/conciliacao', icon: Landmark, soon: true },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { label: 'Empresas', to: '/empresas', icon: Building2 },
      { label: 'Plano de Contas', to: '/plano-de-contas', icon: ListTree },
      { label: 'Centros de Custo', to: '/centros-de-custo', icon: Building },
      { label: 'Contatos', to: '/contatos', icon: Users },
      { label: 'Contas Bancárias', to: '/contas-bancarias', icon: Landmark },
    ],
  },
  {
    title: 'Próximas fases',
    items: [
      { label: 'Funcionários', to: '/funcionarios', icon: Users, soon: true },
      { label: 'CRM', to: '/crm', icon: Target, soon: true },
    ],
  },
]
