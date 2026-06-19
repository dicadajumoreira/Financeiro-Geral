import type { AccountType } from '@/types/database'

export interface AccountTemplate {
  name: string
  type: AccountType
  dre_group: string
}

// Plano de contas modelo baseado nas categorias reais usadas pela operação.
export const CHART_TEMPLATE: AccountTemplate[] = [
  // Receitas
  { name: 'RECEITA DE SERVIÇOS', type: 'receita', dre_group: 'Receita Bruta' },
  { name: 'OUTRAS RECEITAS', type: 'receita', dre_group: 'Receita Bruta' },
  // Despesas
  { name: 'COMISSÕES', type: 'despesa', dre_group: 'Despesas Comerciais' },
  { name: 'FOLHA DE PAGAMENTO', type: 'despesa', dre_group: 'Despesas com Pessoal' },
  { name: 'BENEFÍCIOS', type: 'despesa', dre_group: 'Despesas com Pessoal' },
  { name: 'ALUGUÉIS', type: 'despesa', dre_group: 'Despesas Operacionais' },
  { name: 'CONSUMO (ÁGUA/LUZ/TELEFONIA)', type: 'despesa', dre_group: 'Despesas Operacionais' },
  { name: 'ASSINATURAS E SOFTWARES', type: 'despesa', dre_group: 'Despesas Operacionais' },
  { name: 'HONORÁRIOS', type: 'despesa', dre_group: 'Despesas Operacionais' },
  { name: 'IMPOSTOS E TAXAS', type: 'despesa', dre_group: 'Impostos' },
  { name: 'DESPESAS FINANCEIRAS', type: 'despesa', dre_group: 'Despesas Financeiras' },
  { name: 'OUTROS', type: 'despesa', dre_group: 'Despesas Operacionais' },
]

// Nome de categoria usado quando a detecção não encontra correspondência.
export const FALLBACK_CATEGORY = 'OUTROS'
