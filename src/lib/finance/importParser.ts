import * as XLSX from 'xlsx'
import { FALLBACK_CATEGORY } from './chartTemplate'
import type { Company } from '@/types/database'

export interface RawExpenseRow {
  pagamento: string
  descricao: string
  status: string
  valor: string
  dataDebito: string
  prazo: string
  sheet: string
}

export interface ParsedRow {
  id: string
  include: boolean
  descricao: string
  valor: number
  /** data de pagamento (caixa) — vazia se não concluída */
  paymentDate: string | null
  dueDate: string
  status: 'pago' | 'pendente'
  companyId: string | null
  categoryName: string // categoria detectada (por nome)
  raw: RawExpenseRow
}

// --------- Conversões ----------

/** "R$ 1.234,56" -> 1234.56 */
export function parseBRL(input: string): number {
  if (!input) return 0
  const s = String(input)
    .replace(/\s/g, '')
    .replace(/r\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** "01/06/2026" -> "2026-06-01" (aceita também datas já ISO) */
export function parseDateBR(input: string): string | null {
  if (!input) return null
  const s = String(input).trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const [, d, mo, y] = m
    const yyyy = y.length === 2 ? `20${y}` : y
    return `${yyyy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

// --------- Detecção de categoria ----------

const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ['COMISSÃO', 'COMISSAO'], category: 'COMISSÕES' },
  { keywords: ['FOLHA', 'SALARIO', 'SALÁRIO', 'RESCISÃO', 'RESCISAO', '13º', 'FÉRIAS', 'FERIAS'], category: 'FOLHA DE PAGAMENTO' },
  { keywords: ['VT ', 'VALE TRANSPORTE', 'AMIL', 'BENEF', 'PLANO DE SAUDE', 'PLANO DE SAÚDE', 'SAUDE', 'VR ', 'VALE REFEIÇÃO'], category: 'BENEFÍCIOS' },
  { keywords: ['ALUGUEL', 'ALUGUÉL', 'ALUGUÉIS', 'LOCAÇÃO IMOVEL'], category: 'ALUGUÉIS' },
  { keywords: ['VIVO', 'CLARO', 'ENEL', 'SABESP', 'AGUA', 'ÁGUA', 'ENERGIA', 'INTERNET', 'MUNDIVOX', 'LINKTEL', 'TELEFON'], category: 'CONSUMO (ÁGUA/LUZ/TELEFONIA)' },
  { keywords: ['ISS', 'IPTU', 'IMPOSTO', 'TRIBUTO', 'LICENÇA', 'LICENCA', 'DARF', 'GPS', 'TRIBUNAL', 'PREFEITURA', 'IRPJ', ' IR ', 'TAXA'], category: 'IMPOSTOS E TAXAS' },
  { keywords: ['HONORÁRIO', 'HONORARIO', ' ADV', 'CONTÁBIL', 'CONTABIL', 'JFA', 'ADVOG'], category: 'HONORÁRIOS' },
  {
    keywords: ['SUPERLÓGICA', 'SUPERLOGICA', 'IMODULO', 'IMÓDULO', 'PROCOB', 'MOSKIT', 'BIG DATA', 'IPSPACES', 'AUTENTIQUE', 'SINDICONET', 'I-VALUE', 'IVALUE', 'STEMME', 'ASSINATURA', 'SOFTWARE', 'COWORKING', 'VERISURE'],
    category: 'ASSINATURAS E SOFTWARES',
  },
  { keywords: ['JUROS', 'TARIFA BANC', 'IOF', 'TAXA BANC'], category: 'DESPESAS FINANCEIRAS' },
]

// Valores conhecidos na coluna "Pagamento" que já são categorias.
const PAGAMENTO_AS_CATEGORY: Record<string, string> = {
  ASSINATURAS: 'ASSINATURAS E SOFTWARES',
  CONSUMO: 'CONSUMO (ÁGUA/LUZ/TELEFONIA)',
  BENEFICIOS: 'BENEFÍCIOS',
  BENEFÍCIOS: 'BENEFÍCIOS',
  IMPOSTO: 'IMPOSTOS E TAXAS',
  IMPOSTOS: 'IMPOSTOS E TAXAS',
  'FOLHA DE PGTO': 'FOLHA DE PAGAMENTO',
}

export function detectCategory(pagamento: string, descricao: string): string {
  const pag = (pagamento || '').trim().toUpperCase()
  if (PAGAMENTO_AS_CATEGORY[pag]) return PAGAMENTO_AS_CATEGORY[pag]

  const text = ` ${(pagamento || '')} ${descricao || ''} `.toUpperCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.category
  }
  return FALLBACK_CATEGORY
}

// --------- Detecção de empresa ----------

const STOPWORDS = new Set(['LTDA', 'ME', 'EIRELI', 'SA', 'S/A', 'EPP', 'DE', 'DA', 'DO', 'E', 'CONTA'])

/** Tokens significativos do nome de uma empresa (>=3 letras, sem stopwords). */
function companyTokens(c: Company): string[] {
  const name = `${c.trade_name ?? ''} ${c.legal_name}`.toUpperCase()
  return name
    .split(/[^A-ZÀ-Ú0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Tenta achar a empresa cujo nome aparece no texto (Pagamento + Descrição). */
export function detectCompany(pagamento: string, descricao: string, companies: Company[]): string | null {
  const text = ` ${(pagamento || '')} ${descricao || ''} `.toUpperCase()
  for (const c of companies) {
    for (const token of companyTokens(c)) {
      if (text.includes(token)) return c.id
    }
  }
  return null
}

// --------- Leitura do arquivo ----------

const HEADER_ALIASES: Record<keyof Omit<RawExpenseRow, 'sheet'>, string[]> = {
  pagamento: ['PAGAMENTO', 'TIPO', 'CATEGORIA'],
  descricao: ['DESCRIÇÃO', 'DESCRICAO', 'DESCRIÇAO'],
  status: ['STATUS', 'SITUAÇÃO', 'SITUACAO'],
  valor: ['VALOR', 'VALOR (R$)', 'R$'],
  dataDebito: ['DATA DE DÉBITO', 'DATA DE DEBITO', 'DATA DÉBITO', 'DATA DEBITO', 'DATA', 'PAGAMENTO EM'],
  prazo: ['PRAZO', 'VENCIMENTO', 'VENC'],
}

function findColumn(headers: string[], aliases: string[]): number {
  const up = headers.map((h) => (h || '').trim().toUpperCase())
  for (const a of aliases) {
    const idx = up.indexOf(a)
    if (idx !== -1) return idx
  }
  // match parcial
  for (let i = 0; i < up.length; i++) {
    if (aliases.some((a) => up[i].includes(a))) return i
  }
  return -1
}

/** Lê todas as abas do arquivo e extrai as linhas de despesa. */
export function readExpenseFile(data: ArrayBuffer): RawExpenseRow[] {
  const wb = XLSX.read(data, { type: 'array' })
  const out: RawExpenseRow[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })
    if (!rows.length) continue

    // Encontra a linha de cabeçalho (contém "DESCRIÇÃO" e "VALOR")
    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const up = rows[i].map((c) => (c || '').toString().toUpperCase())
      if (up.some((c) => c.includes('DESCRI')) && up.some((c) => c.includes('VALOR'))) {
        headerIdx = i
        break
      }
    }
    if (headerIdx === -1) continue

    const headers = rows[headerIdx].map((h) => (h || '').toString())
    const col = {
      pagamento: findColumn(headers, HEADER_ALIASES.pagamento),
      descricao: findColumn(headers, HEADER_ALIASES.descricao),
      status: findColumn(headers, HEADER_ALIASES.status),
      valor: findColumn(headers, HEADER_ALIASES.valor),
      dataDebito: findColumn(headers, HEADER_ALIASES.dataDebito),
      prazo: findColumn(headers, HEADER_ALIASES.prazo),
    }

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      const get = (idx: number) => (idx >= 0 ? (r[idx] ?? '').toString().trim() : '')
      const descricao = get(col.descricao)
      const valor = get(col.valor)
      if (!descricao && !valor) continue // linha vazia
      out.push({
        pagamento: get(col.pagamento),
        descricao,
        status: get(col.status),
        valor,
        dataDebito: get(col.dataDebito),
        prazo: get(col.prazo),
        sheet: sheetName,
      })
    }
  }
  return out
}

/** Transforma linhas cruas em linhas revisáveis, com detecção aplicada. */
export function buildParsedRows(raws: RawExpenseRow[], companies: Company[]): ParsedRow[] {
  return raws.map((raw, i) => {
    const payment = parseDateBR(raw.dataDebito)
    const due = parseDateBR(raw.prazo) || payment || ''
    const isPaid = /CONCLU|PAGO|QUITAD/i.test(raw.status) || !!payment
    return {
      id: `row-${i}`,
      include: true,
      descricao: raw.descricao.toUpperCase(),
      valor: parseBRL(raw.valor),
      paymentDate: payment,
      dueDate: due || payment || '',
      status: isPaid ? 'pago' : 'pendente',
      companyId: detectCompany(raw.pagamento, raw.descricao, companies),
      categoryName: detectCategory(raw.pagamento, raw.descricao),
      raw,
    }
  })
}
