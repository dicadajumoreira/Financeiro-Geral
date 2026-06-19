// Dados bancários / PIX de um contato (armazenados em contacts.bank_info jsonb).
export interface BankInfo {
  pix_tipo?: string
  pix_chave?: string
  tipo_conta?: string
  banco?: string
  agencia?: string
  conta?: string
}

export const PIX_TIPOS = ['CNPJ', 'CPF', 'E-mail', 'Celular', 'Aleatória'] as const
export const TIPOS_CONTA = ['Conta corrente', 'Conta poupança'] as const
