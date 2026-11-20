import { diffDays, monthEnd, monthStart, type DayRange } from '@/features/roadmap/dates'
import type { TimelineWindow } from '@/features/roadmap/engine'

export type Paper = 'a4' | 'letter'
export type Orientation = 'portrait' | 'landscape'

/** CSS pixels at 96 per inch. */
const SIZES: Record<Paper, { w: number; h: number; label: string }> = {
  a4: { w: (210 / 25.4) * 96, h: (297 / 25.4) * 96, label: 'A4' },
  letter: { w: 8.5 * 96, h: 11 * 96, label: 'Letter' },
}
export const PAPER_OPTIONS = (Object.keys(SIZES) as Paper[]).map((p) => ({
  value: p,
  label: SIZES[p].label,
}))

/** Page furniture in pixels: margin all round, a running header at the top and a footer at the bottom. */
export const MARGIN = 48
export const HEADER_HEIGHT = 44
export const FOOTER_HEIGHT = 30

export interface Geometry {
  /** Whole sheet. */
  width: number
  height: number
  /** The area left for content once margins, header and footer are taken out. */
  contentWidth: number
  contentHeight: number
}

export function geometry(paper: Paper, orientation: Orientation): Geometry {
  const { w, h } = SIZES[paper]
  const width = Math.round(orientation === 'landscape' ? h : w)
  const height = Math.round(orientation === 'landscape' ? w : h)
  return {
    width,
    height,
    contentWidth: width - MARGIN * 2,
    contentHeight: height - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT,
  }
}

export const cssPageSize = (paper: Paper, orientation: Orientation) =>
  `${paper === 'a4' ? 'A4' : 'letter'} ${orientation}`

/**
 * Split a list of blocks (by their heights) into pages. A block is never cut: if it does not fit, it starts the
 * next page. A block marked `keep` stays with the one after it, so a heading is never left alone at the foot of a
 * page. A block taller than a whole page gets a page to itself and is allowed to overflow.
 * `reserved` is height used on every page by something repeated (such as a timeline's month axis).
 * Returns the index of each block on each page.
 */
export function paginate(
  heights: number[],
  keep: boolean[],
  limit: number,
  reserved = 0,
): number[][] {
  const room = Math.max(1, limit - reserved)
  const pages: number[][] = []
  let page: number[] = []
  let used = 0
  const startPage = () => {
    if (page.length) pages.push(page)
    page = []
    used = 0
  }
  for (let i = 0; i < heights.length; i++) {
    // The group that has to stay together: this block, plus following blocks while each asks to keep with next.
    let end = i
    while (end < heights.length - 1 && keep[end]) end++
    const group = heights.slice(i, end + 1).reduce((a, b) => a + b, 0)
    if (used > 0 && used + group > room) startPage()
    // A group that cannot fit anywhere is placed block by block, breaking only where it must.
    if (group > room) {
      for (let j = i; j <= end; j++) {
        if (used > 0 && used + heights[j]! > room) startPage()
        page.push(j)
        used += heights[j]!
      }
    } else {
      for (let j = i; j <= end; j++) page.push(j)
      used += group
    }
    i = end
  }
  if (page.length) pages.push(page)
  return pages.length ? pages : [[]]
}

/**
 * A timeline window that fits the work: from the month of the earliest date to the month of the latest,
 * at least a quarter and at most three years, so a bar is never lost and a stray date cannot flatten the chart.
 */
export function fitWindow(ranges: DayRange[], fallback: string): TimelineWindow {
  const starts = ranges.map((r) => r.start).sort()
  const ends = ranges.map((r) => r.end).sort()
  const first = monthStart(starts[0] ?? fallback)
  const last = ends.at(-1) ?? fallback
  let count = 1
  while (count < 36 && monthEnd(first, count - 1) < last) count++
  count = Math.max(3, count)
  const months = Array.from({ length: count }, (_, i) => {
    const s = monthStart(first, i)
    return { start: s, days: diffDays(s, monthStart(first, i + 1)) }
  })
  const end = monthEnd(first, count - 1)
  return { start: first, end, days: diffDays(first, end) + 1, months }
}
