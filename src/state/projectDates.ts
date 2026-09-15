import type { ProjectMetadata } from '../types/project'

export const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export interface YearMonth {
  year: string
  month: string
}

export interface PotentialImplementationPeriod {
  start: string
  end: string
  startLabel: string
  endLabel: string
}

export function isYearMonth(value: string): boolean {
  return YEAR_MONTH_PATTERN.test(value.trim())
}

export function parseYearMonth(value: string): YearMonth | null {
  if (!isYearMonth(value)) return null
  return {
    year: value.slice(0, 4),
    month: value.slice(5, 7),
  }
}

export function formatYearMonthDisplay(value: string): string {
  const parsed = parseYearMonth(value)
  if (!parsed) return value.trim() ? value : 'Not set'
  const monthIndex = Number(parsed.month) - 1
  const monthName = MONTH_NAMES[monthIndex]
  return monthName ? `${monthName} ${parsed.year}` : value
}

export function toYearMonthValue(year: string, month: string): string {
  if (!year || !month) return ''
  const candidate = `${year}-${month}`
  return isYearMonth(candidate) ? candidate : ''
}

export function getMonthOptions(): Array<{ value: string; label: string }> {
  return MONTH_NAMES.map((label, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label,
  }))
}

export function getYearOptions(referenceYear = new Date().getFullYear()): string[] {
  const start = referenceYear - 2
  const years: string[] = []
  for (let year = start; year <= referenceYear + 15; year += 1) {
    years.push(String(year))
  }
  return years
}

export function getPotentialImplementationPeriod(
  metadata: Pick<ProjectMetadata, 'plannedStartDate' | 'plannedEndDate'>,
): PotentialImplementationPeriod {
  return {
    start: metadata.plannedStartDate,
    end: metadata.plannedEndDate,
    startLabel: formatYearMonthDisplay(metadata.plannedStartDate),
    endLabel: formatYearMonthDisplay(metadata.plannedEndDate),
  }
}
