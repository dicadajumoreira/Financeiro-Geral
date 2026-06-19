import { addDays, addMonths, isAfter, parseISO, format } from 'date-fns'
import type { Recurrence, RecurrenceFrequency } from '@/types/database'

const MONTH_STEP: Partial<Record<RecurrenceFrequency, number>> = {
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

function nextDate(date: Date, freq: RecurrenceFrequency): Date {
  if (freq === 'semanal') return addDays(date, 7)
  if (freq === 'quinzenal') return addDays(date, 15)
  return addMonths(date, MONTH_STEP[freq] ?? 1)
}

/**
 * Calcula as datas de vencimento de uma recorrência entre start_date e `until`
 * (limitado por end_date e occurrences). Retorna strings yyyy-MM-dd.
 */
export function occurrenceDates(rec: Recurrence, until: Date): string[] {
  const dates: string[] = []
  let cursor = parseISO(rec.start_date)
  const limit = rec.end_date ? parseISO(rec.end_date) : null
  const max = rec.occurrences ?? 1000

  while (dates.length < max) {
    if (isAfter(cursor, until)) break
    if (limit && isAfter(cursor, limit)) break
    dates.push(format(cursor, 'yyyy-MM-dd'))
    cursor = nextDate(cursor, rec.frequency)
  }
  return dates
}
