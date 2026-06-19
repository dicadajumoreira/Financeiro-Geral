import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Formata valor numérico como moeda BRL. */
export function formatBRL(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0)
}

/** Formata número com 2 casas no padrão pt-BR (sem símbolo de moeda). */
export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

/** Formata uma data ISO (yyyy-MM-dd ou timestamp) como dd/MM/yyyy. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

/** Mês/ano por extenso, ex.: "junho de 2026". */
export function formatMonthYear(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, "MMMM 'de' yyyy", { locale: ptBR })
}

/** Aplica máscara de CNPJ (00.000.000/0000-00). */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '—'
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/** Aplica máscara de CPF ou CNPJ conforme o tamanho. */
export function formatDocument(doc: string | null | undefined): string {
  if (!doc) return '—'
  const digits = doc.replace(/\D/g, '')
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return formatCNPJ(doc)
}

/** Converte string monetária do usuário (1.234,56) para número. */
export function parseBRLInput(input: string): number {
  if (!input) return 0
  const normalized = input
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

/** Data de hoje em formato yyyy-MM-dd. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
