import * as XLSX from 'xlsx'
import type { BankInfo } from './bankInfo'
import type { ContactType } from '@/types/database'

export interface ParsedFavorecido {
  id: string
  include: boolean
  name: string
  document: string // só dígitos
  tipoPessoa: string
  type: ContactType
  bankInfo: BankInfo
}

type Cell = string | number | null | undefined

const PIX_TYPE_RE = /^(CNPJ|CPF|E-?MAIL|CELULAR|TELEFONE|ALEAT[ÓO]RIA|EVP|CHAVE)/i
const CONTA_RE = /CONTA\s+(CORRENTE|POUPAN)/i

function cellStr(c: Cell): string {
  return (c ?? '').toString().trim()
}

function findCol(headers: string[], aliases: string[]): number {
  const up = headers.map((h) => h.trim().toUpperCase())
  for (const a of aliases) {
    const i = up.indexOf(a)
    if (i !== -1) return i
  }
  for (let i = 0; i < up.length; i++) {
    if (aliases.some((a) => up[i].includes(a))) return i
  }
  return -1
}

/** Extrai dados bancários/PIX varrendo as células após o documento. */
function parseBank(cells: string[]): BankInfo {
  const bank: BankInfo = {}
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i]
    if (!v) continue
    if (!bank.tipo_conta && CONTA_RE.test(v)) {
      bank.tipo_conta = /POUPAN/i.test(v) ? 'Conta poupança' : 'Conta corrente'
      if (cells[i + 1]) bank.agencia = cells[i + 1]
      if (cells[i + 2]) bank.conta = cells[i + 2]
    } else if (!bank.pix_tipo && PIX_TYPE_RE.test(v) && !CONTA_RE.test(v)) {
      bank.pix_tipo = v
      if (cells[i + 1]) bank.pix_chave = cells[i + 1]
    }
  }
  return bank
}

export function readFavorecidos(data: ArrayBuffer): ParsedFavorecido[] {
  const wb = XLSX.read(data, { type: 'array' })
  const out: ParsedFavorecido[] = []
  let seq = 0

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: false, defval: '' })
    if (!rows.length) continue

    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const up = rows[i].map((c) => cellStr(c).toUpperCase())
      if (up.some((c) => c.includes('FAVORECID') || c.includes('NOME') || c.includes('RAZ')) && up.some((c) => c.includes('CPF') || c.includes('CNPJ'))) {
        headerIdx = i
        break
      }
    }
    if (headerIdx === -1) continue

    const headers = rows[headerIdx].map((h) => cellStr(h))
    const idxName = findCol(headers, ['FAVORECIDO', 'NOME/RAZÃO', 'NOME', 'RAZÃO SOCIAL', 'RAZAO'])
    const idxTipoPessoa = findCol(headers, ['TIPO DE PESSOA', 'TIPO PESSOA'])
    const idxDocNum = findCol(headers, ['SÓ NÚMEROS', 'SO NUMEROS', 'NÚMEROS', 'NUMEROS'])
    const idxDocFmt = findCol(headers, ['CPF/CNPJ', 'CPF', 'CNPJ', 'DOCUMENTO'])
    const docIdx = idxDocNum !== -1 ? idxDocNum : idxDocFmt

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      const name = idxName >= 0 ? cellStr(r[idxName]) : ''
      if (!name) continue
      const docRaw = docIdx >= 0 ? cellStr(r[docIdx]) : ''
      const document = docRaw.replace(/\D/g, '')
      // Varre as células após o documento em busca de PIX/conta.
      const scanFrom = (docIdx >= 0 ? docIdx : 0) + 1
      const tail = r.slice(scanFrom).map((c) => cellStr(c))
      out.push({
        id: `fav-${seq++}`,
        include: true,
        name: name.toUpperCase(),
        document,
        tipoPessoa: idxTipoPessoa >= 0 ? cellStr(r[idxTipoPessoa]) : '',
        type: 'fornecedor',
        bankInfo: parseBank(tail),
      })
    }
  }
  return out
}
