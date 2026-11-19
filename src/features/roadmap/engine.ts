import {
  LANES,
  type Dependency,
  type Feature,
  type Initiative,
  type Lane,
  type Milestone,
  type PlanningMode,
  type Priority,
  type Roadmap,
  type RoadmapEntry,
  type WorkStatus,
} from '@/domain'
import {
  addDays,
  diffDays,
  monthEnd,
  monthName,
  monthStart,
  quarterOf,
  yearOf,
  type DayRange,
} from './dates'
import { sortItems } from '@/features/planning/query'

/**
 * The roadmap engine: pure functions over the shared records. Nothing here reads or writes storage, and
 * no view has data of its own. Every view calls `buildRows` on the same roadmap and draws the result.
 */
export type ItemType = 'initiative' | 'feature'
export type Item = Initiative | Feature

export interface RoadmapRow {
  key: string
  entry: RoadmapEntry
  kind: ItemType
  item: Item
}

export const rowKey = (type: ItemType, id: string) => `${type}:${id}`

/** The roadmap's entries joined to their initiatives and features, in the roadmap's own order. */
export function buildRows(
  roadmap: Roadmap,
  initiatives: Initiative[],
  features: Feature[],
): RoadmapRow[] {
  const byInitiative = new Map(initiatives.map((i) => [i.id, i]))
  const byFeature = new Map(features.map((f) => [f.id, f]))
  return [...roadmap.entries]
    .sort((a, b) => a.order - b.order)
    .flatMap((entry) => {
      const item =
        entry.itemType === 'initiative'
          ? byInitiative.get(entry.itemId)
          : byFeature.get(entry.itemId)
      return item && !item.deletedAt
        ? [{ key: rowKey(entry.itemType, entry.itemId), entry, kind: entry.itemType, item }]
        : []
    })
}

export const allowedTypes = (roadmap: Roadmap) =>
  roadmap.itemTypes ?? (['initiative', 'feature', 'milestone'] as const)
export const showsType = (roadmap: Roadmap, type: 'initiative' | 'feature' | 'milestone') =>
  allowedTypes(roadmap).includes(type)

/** Rows of the kinds this roadmap is set to show. */
export const visibleRows = (roadmap: Roadmap, rows: RoadmapRow[]) =>
  rows.filter((r) => showsType(roadmap, r.kind))

// ── Lanes ───────────────────────────────────────────────────────────────────

/**
 * When the roadmap follows dates, "now" is this month and next, "next" is the three months after that,
 * and "later" is everything beyond. Earlier work still counts as now: it is not done until it says so.
 */
export function laneWindows(today: string): Record<Lane, DayRange & { open?: boolean }> {
  return {
    now: { start: monthStart(today), end: monthEnd(today, 1) },
    next: { start: monthStart(today, 2), end: monthEnd(today, 4) },
    later: { start: monthStart(today, 5), end: monthEnd(today, 5), open: true },
  }
}

export function laneFromDates(
  range: { startDate?: string; endDate?: string },
  today: string,
): Lane | undefined {
  const day = range.startDate ?? range.endDate
  if (!day) return undefined
  const w = laneWindows(today)
  if (day <= w.now.end) return 'now'
  if (day <= w.next.end) return 'next'
  return 'later'
}

export const isDated = (item: { startDate?: string; endDate?: string }) =>
  Boolean(item.startDate || item.endDate)

/** Where a row shows in now/next/later: by its dates on a date-based roadmap, otherwise where it was put. */
export function effectiveLane(
  row: RoadmapRow,
  mode: PlanningMode | undefined,
  today: string,
): Lane | undefined {
  if (mode === 'dates') return laneFromDates(row.item, today) ?? row.entry.lane
  return row.entry.lane
}

/** New dates for moving a dated item into a lane on a date-based roadmap, keeping how long it lasts. */
export function datesForLane(
  lane: Lane,
  item: { startDate?: string; endDate?: string },
  today: string,
): DayRange {
  const start = laneWindows(today)[lane].start
  if (item.startDate && item.endDate)
    return { start, end: addDays(start, Math.max(0, diffDays(item.startDate, item.endDate))) }
  return { start, end: monthEnd(start) } // a month, when there is no length to keep
}

// ── Moving and ordering ─────────────────────────────────────────────────────

export type Place = 'before' | 'after'

/**
 * Put one entry next to another in the roadmap's single order, optionally changing its lane, then renumber
 * everything 1..n. With no anchor the entry goes last. Other entries keep their relative order.
 */
export function placeEntry(
  entries: RoadmapEntry[],
  activeKey: string,
  anchorKey: string | undefined,
  place: Place,
  patch: Partial<RoadmapEntry> = {},
): RoadmapEntry[] {
  const sorted = [...entries].sort((a, b) => a.order - b.order)
  const key = (e: RoadmapEntry) => rowKey(e.itemType, e.itemId)
  const active = sorted.find((e) => key(e) === activeKey)
  if (!active) return entries
  const rest = sorted.filter((e) => e !== active)
  const moved = { ...active, ...patch }
  const anchorIndex = anchorKey ? rest.findIndex((e) => key(e) === anchorKey) : -1
  const at = anchorIndex === -1 ? rest.length : place === 'before' ? anchorIndex : anchorIndex + 1
  rest.splice(at, 0, moved)
  return rest.map((e, index) => ({ ...e, order: index + 1 }))
}

export interface Drop {
  containerId: string
  anchorKey?: string
  place: Place
}

/**
 * Work out where a dragged card lands. `containers` lists the visible card keys in each column; `overId` is
 * what the pointer is over: another card, or a column itself (an empty column, or its empty space).
 * Dropping on a card in the same column puts the dragged card where that card is (so moving down lands
 * after it); dropping on a card in another column inserts before it.
 */
export function resolveDrop(
  containers: Record<string, string[]>,
  activeKey: string,
  overId: string | undefined,
): Drop | undefined {
  if (!overId || overId === activeKey) return undefined
  if (overId in containers) {
    const others = containers[overId]!.filter((k) => k !== activeKey)
    return { containerId: overId, anchorKey: others[others.length - 1], place: 'after' }
  }
  const from = Object.keys(containers).find((c) => containers[c]!.includes(activeKey))
  const to = Object.keys(containers).find((c) => containers[c]!.includes(overId))
  if (!to) return undefined
  if (from === to) {
    const list = containers[to]!
    return {
      containerId: to,
      anchorKey: overId,
      place: list.indexOf(activeKey) < list.indexOf(overId) ? 'after' : 'before',
    }
  }
  return { containerId: to, anchorKey: overId, place: 'before' }
}

// ── Filtering and sorting ───────────────────────────────────────────────────

export interface RowFilters {
  q: string
  status: string
  priority: string
  initiative: string
}
export const NO_INITIATIVE = 'none'

const parentOf = (row: RoadmapRow): string | undefined =>
  row.kind === 'feature' ? (row.item as Feature).initiativeId : undefined

export function filterRows(
  rows: RoadmapRow[],
  f: RowFilters,
  initiatives: Initiative[],
): RoadmapRow[] {
  const needle = f.q.trim().toLowerCase()
  return rows.filter((row) => {
    const parent = parentOf(row)
    const parentTitle = initiatives.find((i) => i.id === parent)?.title
    if (
      needle &&
      ![row.item.title, row.item.description, row.item.owner, parentTitle].some((t) =>
        t?.toLowerCase().includes(needle),
      )
    )
      return false
    if (f.status && row.item.status !== f.status) return false
    if (
      f.priority &&
      (f.priority === 'none' ? row.item.priority : row.item.priority !== f.priority)
    )
      return false
    if (f.initiative) {
      if (f.initiative === NO_INITIATIVE) return row.kind === 'feature' && !parent
      // An initiative's filter keeps the initiative itself and its features.
      return row.kind === 'initiative' ? row.item.id === f.initiative : parent === f.initiative
    }
    return true
  })
}

export function sortRows(rows: RoadmapRow[], sort: string): RoadmapRow[] {
  if (sort === 'manual' || !sort) return [...rows].sort((a, b) => a.entry.order - b.entry.order)
  const wrapped = rows.map((row) => ({ ...row.item, order: row.entry.order, row }))
  return sortItems(wrapped, sort).map((w) => w.row)
}

// ── Board ───────────────────────────────────────────────────────────────────

export type GroupBy = 'status' | 'priority' | 'initiative'
export interface BoardColumn {
  id: string
  label: string
  rows: RoadmapRow[]
  /** Dragging into this column changes this group value. */
  value: string | undefined
}

const STATUS_ORDER: WorkStatus[] = [
  'idea',
  'planned',
  'in-progress',
  'shipped',
  'paused',
  'dropped',
]
const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low']
const STATUS_TEXT: Record<WorkStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  'in-progress': 'In progress',
  shipped: 'Shipped',
  paused: 'Paused',
  dropped: 'Dropped',
}
const PRIORITY_TEXT: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function boardColumns(
  rows: RoadmapRow[],
  groupBy: GroupBy,
  initiatives: Initiative[],
  sort: string,
): BoardColumn[] {
  const sorted = sortRows(rows, sort)
  if (groupBy === 'status') {
    return STATUS_ORDER.filter((s, i) => i < 4 || sorted.some((r) => r.item.status === s)).map(
      (s) => ({
        id: `status:${s}`,
        label: STATUS_TEXT[s],
        value: s,
        rows: sorted.filter((r) => r.item.status === s),
      }),
    )
  }
  if (groupBy === 'priority') {
    return [
      ...PRIORITY_ORDER.map((p) => ({
        id: `priority:${p}`,
        label: PRIORITY_TEXT[p],
        value: p as string | undefined,
        rows: sorted.filter((r) => r.item.priority === p),
      })),
      {
        id: 'priority:none',
        label: 'No priority',
        value: undefined,
        rows: sorted.filter((r) => !r.item.priority),
      },
    ]
  }
  // By initiative: the columns are initiatives and the cards are their features. An initiative's own entry is
  // the column, so it is not also a card.
  const cards = sorted.filter((r) => r.kind === 'feature')
  const onRoadmap = new Set(sorted.filter((r) => r.kind === 'initiative').map((r) => r.item.id))
  const columns = [...initiatives]
    .sort((a, b) => a.order - b.order)
    .filter((i) => onRoadmap.has(i.id) || cards.some((c) => parentOf(c) === i.id))
    .map((i) => ({
      id: `initiative:${i.id}`,
      label: i.title,
      value: i.id as string | undefined,
      rows: cards.filter((c) => parentOf(c) === i.id),
    }))
  const loose = cards.filter((c) => !parentOf(c))
  return loose.length > 0
    ? [...columns, { id: 'initiative:none', label: 'No initiative', value: undefined, rows: loose }]
    : columns
}

/** The change to an item when its card is dropped in a column. Undefined means this grouping cannot change it. */
export function groupPatch(
  groupBy: GroupBy,
  column: BoardColumn,
  row: RoadmapRow,
): Partial<Initiative & Feature> | undefined {
  if (groupBy === 'status') return { status: column.value as WorkStatus }
  if (groupBy === 'priority') return { priority: column.value as Priority | undefined }
  return row.kind === 'feature' ? { initiativeId: column.value } : undefined
}

// ── Timeline ────────────────────────────────────────────────────────────────

export type Zoom = 'month' | 'quarter' | 'year'
export const ZOOMS: { value: Zoom; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]
/** Months shown at each zoom, and how far the arrows move. */
export const ZOOM_MONTHS: Record<Zoom, number> = { month: 8, quarter: 15, year: 36 }
export const NAV_MONTHS: Record<Zoom, number> = { month: 1, quarter: 3, year: 12 }

export interface TimelineWindow {
  start: string
  /** Last day shown. */
  end: string
  days: number
  months: { start: string; days: number }[]
}

export function timelineWindow(anchor: string, zoom: Zoom): TimelineWindow {
  const start = monthStart(anchor)
  const count = ZOOM_MONTHS[zoom]
  const months = Array.from({ length: count }, (_, i) => {
    const s = monthStart(start, i)
    return { start: s, days: diffDays(s, monthStart(start, i + 1)) }
  })
  const end = monthEnd(start, count - 1)
  return { start, end, days: diffDays(start, end) + 1, months }
}

export interface HeaderSegment {
  label: string
  /** Percent from the left edge, and percent wide. */
  left: number
  width: number
}

/** Header labels: months when zoomed in, quarters in the middle, years when zoomed out. */
export function headerSegments(w: TimelineWindow, zoom: Zoom): HeaderSegment[] {
  const groups: { key: string; label: string; days: number }[] = []
  for (const m of w.months) {
    const year = yearOf(m.start)
    const key =
      zoom === 'month'
        ? m.start
        : zoom === 'quarter'
          ? `${year}-Q${quarterOf(m.start)}`
          : String(year)
    const label =
      zoom === 'month'
        ? `${monthName(m.start)} ${year}`
        : zoom === 'quarter'
          ? `Q${quarterOf(m.start)} ${year}`
          : String(year)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.days += m.days
    else groups.push({ key, label, days: m.days })
  }
  let offset = 0
  return groups.map((g) => {
    const seg = { label: g.label, left: (offset / w.days) * 100, width: (g.days / w.days) * 100 }
    offset += g.days
    return seg
  })
}

/** Percent along the window for a day (before the window is negative, after it is over 100). */
export const percentOf = (day: string, w: TimelineWindow) => (diffDays(w.start, day) / w.days) * 100

export interface Span {
  left: number
  width: number
  /** The bar starts before / ends after the visible window. */
  clippedStart: boolean
  clippedEnd: boolean
  visible: boolean
}

/** A bar's position in percent, clipped to the window. An end date is inclusive, so the bar covers the whole day. */
export function spanOf(range: DayRange, w: TimelineWindow): Span {
  const visible = range.end >= w.start && range.start <= w.end
  const left = Math.max(0, percentOf(range.start, w))
  const right = Math.min(100, percentOf(addDays(range.end, 1), w))
  return {
    left,
    width: Math.max(0, right - left),
    clippedStart: range.start < w.start,
    clippedEnd: range.end > w.end,
    visible,
  }
}

/** Where to open the timeline: the month before today, or earlier if work was scheduled before that. */
export function initialAnchor(today: string, ranges: DayRange[]): string {
  const earliest = ranges.reduce<string | undefined>(
    (min, r) => (min === undefined || r.start < min ? r.start : min),
    undefined,
  )
  const base = earliest && earliest < today ? earliest : today
  return monthStart(base, base === today ? -1 : 0)
}

/** Days in a drag step: finer when zoomed in. */
export const snapDays = (zoom: Zoom) => (zoom === 'month' ? 1 : 7)

/** How many days a pointer movement of `dx` pixels is worth over a track `width` pixels wide. */
export function pixelsToDays(dx: number, width: number, w: TimelineWindow, zoom: Zoom): number {
  if (width <= 0) return 0
  const step = snapDays(zoom)
  return Math.round(((dx / width) * w.days) / step) * step
}

export const rangeOf = (item: { startDate?: string; endDate?: string }): DayRange | undefined => {
  const start = item.startDate ?? item.endDate
  const end = item.endDate ?? item.startDate
  return start && end ? { start, end } : undefined
}

// ── Swimlanes ───────────────────────────────────────────────────────────────

export interface Swimlane {
  id: string
  title: string
  initiative?: Initiative
  /** The initiative's own row on this roadmap, if it is on it. */
  own?: RoadmapRow
  features: RoadmapRow[]
}

/** One lane per initiative that is on the roadmap or has features on it, plus one for loose features. */
export function swimlanes(rows: RoadmapRow[], initiatives: Initiative[]): Swimlane[] {
  const features = rows.filter((r) => r.kind === 'feature')
  const own = new Map(rows.filter((r) => r.kind === 'initiative').map((r) => [r.item.id, r]))
  const lanes: Swimlane[] = [...initiatives]
    .sort((a, b) => a.order - b.order)
    .flatMap((i) => {
      const mine = features.filter((f) => parentOf(f) === i.id)
      return own.has(i.id) || mine.length > 0
        ? [{ id: i.id, title: i.title, initiative: i, own: own.get(i.id), features: mine }]
        : []
    })
  const loose = features.filter((f) => !parentOf(f))
  return loose.length > 0
    ? [...lanes, { id: 'none', title: 'No initiative', features: loose }]
    : lanes
}

// ── Dependencies ────────────────────────────────────────────────────────────

/** Links where both ends are rows in this view, so a link to something hidden is not drawn. */
export function visibleLinks(deps: Dependency[], keys: Set<string>) {
  return deps.filter(
    (d) => keys.has(rowKey(d.fromType, d.fromId)) && keys.has(rowKey(d.toType, d.toId)),
  )
}

// ── Milestones ──────────────────────────────────────────────────────────────

export const sortedMilestones = (ms: Milestone[]) =>
  [...ms].sort((a, b) => a.date.localeCompare(b.date))

export const LANE_ORDER = LANES
