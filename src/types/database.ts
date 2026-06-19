// Tipos do banco (espelham supabase/migrations/0001_init.sql).
// Mantidos à mão; se preferir, gere com `supabase gen types typescript`.

export type MembershipRole = 'owner' | 'admin' | 'finance' | 'viewer'
export type AccountType = 'receita' | 'despesa'
export type TransactionKind = 'receita' | 'despesa'
export type TransactionStatus = 'pendente' | 'pago' | 'parcial' | 'atrasado' | 'cancelado'
export type ContactType = 'cliente' | 'fornecedor' | 'ambos' | 'funcionario'
export type RecurrenceFrequency =
  | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
export type AttachmentKind = 'comprovante' | 'nota_fiscal' | 'boleto' | 'contrato' | 'outro'

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Organization = {
  id: string
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Membership = {
  id: string
  org_id: string
  user_id: string
  role: MembershipRole
  created_at: string
}

export type Company = {
  id: string
  org_id: string
  legal_name: string
  trade_name: string | null
  cnpj: string | null
  tax_regime: string | null
  email: string | null
  phone: string | null
  address: Record<string, unknown> | null
  logo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ChartAccount = {
  id: string
  org_id: string
  company_id: string
  parent_id: string | null
  code: string | null
  name: string
  type: AccountType
  dre_group: string | null
  is_active: boolean
  created_at: string
}

export type CostCenter = {
  id: string
  org_id: string
  company_id: string
  code: string | null
  name: string
  is_active: boolean
  created_at: string
}

export type Contact = {
  id: string
  org_id: string
  company_id: string | null
  type: ContactType
  name: string
  document: string | null
  email: string | null
  phone: string | null
  address: Record<string, unknown> | null
  bank_info: Record<string, unknown> | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type BankAccount = {
  id: string
  org_id: string
  company_id: string
  name: string
  bank_name: string | null
  bank_code: string | null
  agency: string | null
  account_number: string | null
  type: string | null
  opening_balance: number
  opening_date: string | null
  is_active: boolean
  created_at: string
}

export type Recurrence = {
  id: string
  org_id: string
  company_id: string
  kind: TransactionKind
  description: string
  amount: number
  account_id: string | null
  cost_center_id: string | null
  contact_id: string | null
  bank_account_id: string | null
  frequency: RecurrenceFrequency
  day_of_month: number | null
  start_date: string
  end_date: string | null
  occurrences: number | null
  is_active: boolean
  created_at: string
}

export type Transaction = {
  id: string
  org_id: string
  company_id: string
  kind: TransactionKind
  description: string
  amount: number
  account_id: string | null
  cost_center_id: string | null
  contact_id: string | null
  bank_account_id: string | null
  competence_date: string
  due_date: string
  payment_date: string | null
  paid_amount: number | null
  status: TransactionStatus
  payment_method: string | null
  document_number: string | null
  notes: string | null
  recurrence_id: string | null
  installment_number: number | null
  installment_total: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Attachment = {
  id: string
  org_id: string
  transaction_id: string
  kind: AttachmentKind
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
}

// Helper genérico para tipar tabelas no client do Supabase.
// `Relationships: []` é exigido pelo supabase-js para reconhecer a tabela.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type TableShape<Row, _InsertOmit extends keyof Row = never> = {
  Row: Row
  // Insert/Update parciais: a aplicação monta os payloads explicitamente e o
  // banco preenche defaults (id, timestamps). Evita exigir colunas opcionais.
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<Profile, 'created_at' | 'updated_at'>
      organizations: TableShape<Organization, 'id' | 'created_at' | 'updated_at'>
      memberships: TableShape<Membership, 'id' | 'created_at'>
      companies: TableShape<Company, 'id' | 'created_at' | 'updated_at'>
      chart_of_accounts: TableShape<ChartAccount, 'id' | 'created_at'>
      cost_centers: TableShape<CostCenter, 'id' | 'created_at'>
      contacts: TableShape<Contact, 'id' | 'created_at' | 'updated_at'>
      bank_accounts: TableShape<BankAccount, 'id' | 'created_at'>
      recurrences: TableShape<Recurrence, 'id' | 'created_at'>
      transactions: TableShape<Transaction, 'id' | 'created_at' | 'updated_at'>
      attachments: TableShape<Attachment, 'id' | 'created_at'>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    CompositeTypes: Record<string, never>
    Enums: {
      membership_role: MembershipRole
      account_type: AccountType
      transaction_kind: TransactionKind
      transaction_status: TransactionStatus
      contact_type: ContactType
      recurrence_frequency: RecurrenceFrequency
      attachment_kind: AttachmentKind
    }
  }
}
