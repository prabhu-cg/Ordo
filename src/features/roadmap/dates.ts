/**
 * Calendar-day arithmetic on YYYY-MM-DD strings, always in UTC so a day is the same day everywhere.
 */
const MS = 86_400_000

export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
}
const pad = (n: number) => String(n).padStart(2, '0')
export const formatDay = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export const toDay = (d: Date): string => formatDay(d)
export const today = (now: Date = new Date()): string => formatDay(now)

export const addDays = (day: string, n: number): string =>
  formatDay(new Date(parseDay(day).getTime() + n * MS))
/** Whole days from a to b (b minus a). */
export const diffDays = (a: string, b: string): number =>
  Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / MS)

/** First day of the month that is `offset` months from the month containing `day`. */
export const monthStart = (day: string, offset = 0): string => {
  const d = parseDay(day)
  return formatDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)))
}
/** Last day of the month that is `offset` months from the month containing `day`. */
export const monthEnd = (day: string, offset = 0): string =>
  addDays(monthStart(day, offset + 1), -1)

export interface DayRange {
  start: string
  end: string
}

/** Move a range as a whole, keeping its length. */
export const shiftRange = (r: DayRange, days: number): DayRange => ({
  start: addDays(r.start, days),
  end: addDays(r.end, days),
})

/** Move one edge. The range never becomes shorter than a single day: an edge stops at the other one. */
export function resizeRange(r: DayRange, edge: 'start' | 'end', days: number): DayRange {
  if (edge === 'start') {
    const start = addDays(r.start, days)
    return { start: start > r.end ? r.end : start, end: r.end }
  }
  const end = addDays(r.end, days)
  return { start: r.start, end: end < r.start ? r.start : end }
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
export const monthName = (day: string) => MONTH_NAMES[parseDay(day).getUTCMonth()]!
export const yearOf = (day: string) => parseDay(day).getUTCFullYear()
export const quarterOf = (day: string) => Math.floor(parseDay(day).getUTCMonth() / 3) + 1
