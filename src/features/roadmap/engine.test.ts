import { describe, expect, it } from 'vitest'
import type { Dependency, Feature, Initiative, Roadmap, RoadmapEntry } from '@/domain'
import { addDays, diffDays, monthEnd, monthStart, resizeRange, shiftRange } from './dates'
import {
  boardColumns,
  buildRows,
  datesForLane,
  effectiveLane,
  filterRows,
  groupPatch,
  headerSegments,
  initialAnchor,
  laneFromDates,
  laneWindows,
  pixelsToDays,
  placeEntry,
  rangeOf,
  resolveDrop,
  rowKey,
  sortRows,
  spanOf,
  swimlanes,
  timelineWindow,
  visibleLinks,
  visibleRows,
} from './engine'

const stamp = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  productId: 'p',
}
const ini = (id: string, over: Partial<Initiative> = {}): Initiative => ({
  ...stamp,
  id,
  title: id,
  status: 'idea',
  tagIds: [],
  order: 1,
  ...over,
})
const feat = (id: string, over: Partial<Feature> = {}): Feature => ({
  ...stamp,
  id,
  title: id,
  status: 'idea',
  tagIds: [],
  order: 1,
  ...over,
})
const entry = (
  itemType: 'initiative' | 'feature',
  itemId: string,
  order: number,
  lane?: RoadmapEntry['lane'],
): RoadmapEntry => ({ itemType, itemId, order, lane })
const roadmap = (entries: RoadmapEntry[], over: Partial<Roadmap> = {}): Roadmap => ({
  ...stamp,
  id: 'r',
  name: 'R',
  entries,
  ...over,
})
const keys = (rows: { key: string }[]) => rows.map((r) => r.key)

describe('dates', () => {
  it('adds and measures days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365)
    expect(monthStart('2026-11-19')).toBe('2026-11-01')
    expect(monthEnd('2026-02-10')).toBe('2026-02-28')
    expect(monthEnd('2026-11-19', 1)).toBe('2026-12-31')
    expect(monthStart('2026-11-19', -11)).toBe('2025-12-01')
  })
  it('shifts a range keeping its length, and resizing never inverts it', () => {
    expect(shiftRange({ start: '2026-11-01', end: '2026-11-10' }, 7)).toEqual({
      start: '2026-11-08',
      end: '2026-11-17',
    })
    expect(resizeRange({ start: '2026-11-01', end: '2026-11-10' }, 'end', 5)).toEqual({
      start: '2026-11-01',
      end: '2026-11-15',
    })
    expect(resizeRange({ start: '2026-11-01', end: '2026-11-10' }, 'end', -30)).toEqual({
      start: '2026-11-01',
      end: '2026-11-01',
    })
    expect(resizeRange({ start: '2026-11-01', end: '2026-11-10' }, 'start', 30)).toEqual({
      start: '2026-11-10',
      end: '2026-11-10',
    })
  })
})

describe('buildRows: one list for every view', () => {
  const initiatives = [ini('a'), ini('b')]
  const features = [feat('f1', { initiativeId: 'a' })]
  it("joins entries to their items in the roadmap's order", () => {
    const rows = buildRows(
      roadmap([
        entry('feature', 'f1', 3),
        entry('initiative', 'b', 1),
        entry('initiative', 'a', 2),
      ]),
      initiatives,
      features,
    )
    expect(keys(rows)).toEqual(['initiative:b', 'initiative:a', 'feature:f1'])
  })
  it('skips entries whose item is missing or archived rather than showing a hole', () => {
    const rows = buildRows(
      roadmap([
        entry('initiative', 'a', 1),
        entry('initiative', 'ghost', 2),
        entry('feature', 'f1', 3),
      ]),
      [ini('a'), ini('b', { deletedAt: '2026-01-01T00:00:00.000Z' })],
      [],
    )
    expect(keys(rows)).toEqual(['initiative:a'])
  })
  it('hides kinds the roadmap is set not to show, without dropping them from the roadmap', () => {
    const r = roadmap([entry('initiative', 'a', 1), entry('feature', 'f1', 2)], {
      itemTypes: ['initiative'],
    })
    const rows = buildRows(r, initiatives, features)
    expect(rows).toHaveLength(2)
    expect(keys(visibleRows(r, rows))).toEqual(['initiative:a'])
  })
})

describe('lanes', () => {
  const today = '2026-11-19'
  it('on a date-based roadmap the lane follows the dates', () => {
    expect(laneWindows(today).now).toEqual({ start: '2026-11-01', end: '2026-12-31' })
    expect(laneFromDates({ startDate: '2026-11-25' }, today)).toBe('now')
    expect(laneFromDates({ startDate: '2026-03-01' }, today)).toBe('now') // overdue work is still now
    expect(laneFromDates({ startDate: '2027-01-15' }, today)).toBe('next')
    expect(laneFromDates({ startDate: '2027-03-31' }, today)).toBe('next')
    expect(laneFromDates({ startDate: '2027-04-01' }, today)).toBe('later')
    expect(laneFromDates({ endDate: '2027-09-01' }, today)).toBe('later') // end date alone is enough
    expect(laneFromDates({}, today)).toBeUndefined()
  })
  it('uses the stored lane when flexible, and for undated items either way', () => {
    const row = {
      key: 'k',
      kind: 'initiative' as const,
      entry: entry('initiative', 'a', 1, 'later'),
      item: ini('a', { startDate: '2026-11-25' }),
    }
    expect(effectiveLane(row, 'flexible', today)).toBe('later')
    expect(effectiveLane(row, undefined, today)).toBe('later')
    expect(effectiveLane(row, 'dates', today)).toBe('now')
    expect(effectiveLane({ ...row, item: ini('a') }, 'dates', today)).toBe('later')
  })
  it('moving to a lane on a date-based roadmap moves the dates and keeps the length', () => {
    expect(datesForLane('next', { startDate: '2026-11-02', endDate: '2026-11-12' }, today)).toEqual(
      { start: '2027-01-01', end: '2027-01-11' },
    )
    expect(datesForLane('now', {}, today)).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    // and the result lands in the lane it was sent to
    for (const lane of ['now', 'next', 'later'] as const) {
      const r = datesForLane(lane, { startDate: '2026-11-02', endDate: '2026-11-12' }, today)
      expect(laneFromDates({ startDate: r.start }, today)).toBe(lane)
    }
  })
})

describe('placeEntry: reordering in the one shared order', () => {
  const entries = [
    entry('initiative', 'a', 1, 'now'),
    entry('initiative', 'b', 2, 'now'),
    entry('initiative', 'c', 3, 'next'),
    entry('feature', 'f', 4, 'later'),
  ]
  const order = (es: RoadmapEntry[]) => es.map((e) => e.itemId)
  it('moves before and after an anchor and renumbers 1..n', () => {
    const r = placeEntry(entries, 'initiative:a', 'initiative:b', 'after')
    expect(order(r)).toEqual(['b', 'a', 'c', 'f'])
    expect(r.map((e) => e.order)).toEqual([1, 2, 3, 4])
    expect(order(placeEntry(entries, 'feature:f', 'initiative:a', 'before'))).toEqual([
      'f',
      'a',
      'b',
      'c',
    ])
  })
  it('changes the lane when asked, and with no anchor goes last', () => {
    const r = placeEntry(entries, 'initiative:a', undefined, 'after', { lane: 'later' })
    expect(order(r)).toEqual(['b', 'c', 'f', 'a'])
    expect(r.find((e) => e.itemId === 'a')?.lane).toBe('later')
  })
  it('never loses, duplicates or reorders anything else', () => {
    const r = placeEntry(entries, 'initiative:b', 'initiative:c', 'before', { lane: 'next' })
    expect(order(r).sort()).toEqual(['a', 'b', 'c', 'f'])
    expect(order(r)).toEqual(['a', 'b', 'c', 'f'])
    expect(placeEntry(entries, 'initiative:zzz', undefined, 'after')).toBe(entries)
  })
})

describe('resolveDrop', () => {
  const c = { now: ['i:a', 'i:b', 'i:c'], next: ['i:d'], later: [] as string[] }
  it("lands on another column's card before it, and on an empty column last", () => {
    expect(resolveDrop(c, 'i:a', 'i:d')).toEqual({
      containerId: 'next',
      anchorKey: 'i:d',
      place: 'before',
    })
    expect(resolveDrop(c, 'i:a', 'later')).toEqual({
      containerId: 'later',
      anchorKey: undefined,
      place: 'after',
    })
    expect(resolveDrop(c, 'i:a', 'next')).toEqual({
      containerId: 'next',
      anchorKey: 'i:d',
      place: 'after',
    })
  })
  it('within a column, moving down lands after the card and moving up lands before it', () => {
    expect(resolveDrop(c, 'i:a', 'i:c')).toEqual({
      containerId: 'now',
      anchorKey: 'i:c',
      place: 'after',
    })
    expect(resolveDrop(c, 'i:c', 'i:a')).toEqual({
      containerId: 'now',
      anchorKey: 'i:a',
      place: 'before',
    })
  })
  it('does nothing when dropped on itself, on nothing, or on something unknown', () => {
    expect(resolveDrop(c, 'i:a', 'i:a')).toBeUndefined()
    expect(resolveDrop(c, 'i:a', undefined)).toBeUndefined()
    expect(resolveDrop(c, 'i:a', 'nope')).toBeUndefined()
  })
})

describe('filterRows and sortRows', () => {
  const initiatives = [ini('a', { title: 'Beta' }), ini('b', { title: 'Billing' })]
  const rows = buildRows(
    roadmap([
      entry('initiative', 'a', 1),
      entry('initiative', 'b', 2),
      entry('feature', 'f1', 3),
      entry('feature', 'f2', 4),
      entry('feature', 'f3', 5),
    ]),
    [
      ini('a', { title: 'Beta', priority: 'low' }),
      ini('b', { title: 'Billing', priority: 'critical', status: 'planned' }),
    ],
    [
      feat('f1', { initiativeId: 'a', title: 'Invite', owner: 'Sam' }),
      feat('f2', { initiativeId: 'b', title: 'Checkout', priority: 'high' }),
      feat('f3', { title: 'Loose' }),
    ],
  )
  const f = (over: object = {}) => ({ q: '', status: '', priority: '', initiative: '', ...over })
  it('searches title, owner and parent initiative', () => {
    expect(keys(filterRows(rows, f({ q: 'invite' }), initiatives))).toEqual(['feature:f1'])
    expect(keys(filterRows(rows, f({ q: 'sam' }), initiatives))).toEqual(['feature:f1'])
    expect(keys(filterRows(rows, f({ q: 'billing' }), initiatives))).toEqual([
      'initiative:b',
      'feature:f2',
    ])
  })
  it('filters by status and priority (including not set)', () => {
    expect(keys(filterRows(rows, f({ status: 'planned' }), initiatives))).toEqual(['initiative:b'])
    expect(keys(filterRows(rows, f({ priority: 'high' }), initiatives))).toEqual(['feature:f2'])
    expect(keys(filterRows(rows, f({ priority: 'none' }), initiatives))).toEqual([
      'feature:f1',
      'feature:f3',
    ])
  })
  it('an initiative filter keeps the initiative and its features; "none" is features with no initiative', () => {
    expect(keys(filterRows(rows, f({ initiative: 'a' }), initiatives))).toEqual([
      'initiative:a',
      'feature:f1',
    ])
    expect(keys(filterRows(rows, f({ initiative: 'none' }), initiatives))).toEqual(['feature:f3'])
  })
  it('sorts by priority with unset last, ties in roadmap order, and by title', () => {
    expect(keys(sortRows(rows, 'priority'))).toEqual([
      'initiative:b',
      'feature:f2',
      'initiative:a',
      'feature:f1',
      'feature:f3',
    ])
    expect(keys(sortRows(rows, 'title'))[0]).toBe('initiative:a')
    expect(keys(sortRows(rows, 'manual'))).toEqual(keys(rows))
  })
})

describe('board columns', () => {
  const initiatives = [ini('a', { order: 1 }), ini('b', { order: 2 }), ini('c', { order: 3 })]
  const rows = buildRows(
    roadmap([
      entry('initiative', 'a', 1),
      entry('initiative', 'b', 2),
      entry('feature', 'f1', 3),
      entry('feature', 'f2', 4),
    ]),
    [ini('a', { status: 'planned', priority: 'high', order: 1 }), ini('b', { order: 2 })],
    [feat('f1', { initiativeId: 'a', status: 'in-progress' }), feat('f2', { status: 'paused' })],
  )
  it('groups by status: four columns always, others only when used', () => {
    const cols = boardColumns(rows, 'status', initiatives, 'manual')
    expect(cols.map((c) => c.label)).toEqual([
      'Idea',
      'Planned',
      'In progress',
      'Shipped',
      'Paused',
    ])
    expect(cols.find((c) => c.label === 'Paused')?.rows.map((r) => r.key)).toEqual(['feature:f2'])
  })
  it('groups by priority with a column for none', () => {
    const cols = boardColumns(rows, 'priority', initiatives, 'manual')
    expect(cols.map((c) => c.label)).toEqual(['Critical', 'High', 'Medium', 'Low', 'No priority'])
    expect(cols.find((c) => c.label === 'High')?.rows).toHaveLength(1)
  })
  it('groups by initiative: initiatives are the columns, their features the cards', () => {
    const cols = boardColumns(rows, 'initiative', initiatives, 'manual')
    expect(cols.map((c) => c.label)).toEqual(['a', 'b', 'No initiative'])
    expect(cols[0]!.rows.map((r) => r.key)).toEqual(['feature:f1'])
    expect(cols[2]!.rows.map((r) => r.key)).toEqual(['feature:f2'])
  })
  it('turns a drop into the right change to the item', () => {
    const status = boardColumns(rows, 'status', initiatives, 'manual')
    expect(groupPatch('status', status[3]!, rows[0]!)).toEqual({ status: 'shipped' })
    const pr = boardColumns(rows, 'priority', initiatives, 'manual')
    expect(groupPatch('priority', pr[4]!, rows[0]!)).toEqual({ priority: undefined })
    const init = boardColumns(rows, 'initiative', initiatives, 'manual')
    expect(groupPatch('initiative', init[1]!, rows[3]!)).toEqual({ initiativeId: 'b' })
    expect(groupPatch('initiative', init[1]!, rows[0]!)).toBeUndefined() // an initiative cannot be filed under another
  })
  it('nothing falls out of the board: every row appears in exactly one column', () => {
    for (const g of ['status', 'priority'] as const) {
      const placed = boardColumns(rows, g, initiatives, 'manual').flatMap((c) =>
        c.rows.map((r) => r.key),
      )
      expect(placed.sort()).toEqual(keys(rows).sort())
    }
  })
})

describe('timeline geometry', () => {
  it('builds a window of whole months for each zoom', () => {
    const w = timelineWindow('2026-11-15', 'month')
    expect(w.start).toBe('2026-11-01')
    expect(w.months).toHaveLength(8)
    expect(w.end).toBe('2027-06-30')
    expect(w.months.reduce((n, m) => n + m.days, 0)).toBe(w.days)
    expect(timelineWindow('2026-11-01', 'quarter').months).toHaveLength(15)
    expect(timelineWindow('2026-11-01', 'year').months).toHaveLength(36)
  })
  it('places a bar by percent, with an inclusive end, and clips at the edges', () => {
    const w = timelineWindow('2026-01-01', 'month') // Jan..Aug 2026 = 243 days
    const s = spanOf({ start: '2026-01-01', end: '2026-01-31' }, w)
    expect(s.left).toBe(0)
    expect(s.width).toBeCloseTo((31 / 243) * 100)
    const clipped = spanOf({ start: '2025-12-01', end: '2026-02-01' }, w)
    expect(clipped).toMatchObject({ left: 0, clippedStart: true, clippedEnd: false, visible: true })
    expect(spanOf({ start: '2027-01-01', end: '2027-02-01' }, w).visible).toBe(false)
    expect(spanOf({ start: '2025-01-01', end: '2025-02-01' }, w).visible).toBe(false)
  })
  it('turns a drag distance into whole days, snapped to weeks when zoomed out', () => {
    const w = timelineWindow('2026-01-01', 'month')
    expect(pixelsToDays(0, 1000, w, 'month')).toBe(0)
    expect(pixelsToDays(1000 / 243, 1000, w, 'month')).toBe(1)
    expect(pixelsToDays(-2000 / 243, 1000, w, 'month')).toBe(-2)
    expect(
      Math.abs(pixelsToDays(300, 1000, timelineWindow('2026-01-01', 'year'), 'year') % 7),
    ).toBe(0)
    expect(pixelsToDays(50, 0, w, 'month')).toBe(0)
  })
  it('opens at the month before today, or earlier work', () => {
    expect(initialAnchor('2026-11-19', [])).toBe('2026-10-01')
    expect(initialAnchor('2026-11-19', [{ start: '2027-01-01', end: '2027-02-01' }])).toBe(
      '2026-10-01',
    )
    expect(initialAnchor('2026-11-19', [{ start: '2026-06-10', end: '2026-07-01' }])).toBe(
      '2026-06-01',
    )
  })
  it('reads a range from one or both dates', () => {
    expect(rangeOf({ startDate: '2026-01-01' })).toEqual({ start: '2026-01-01', end: '2026-01-01' })
    expect(rangeOf({ endDate: '2026-01-05' })).toEqual({ start: '2026-01-05', end: '2026-01-05' })
    expect(rangeOf({})).toBeUndefined()
  })
})

describe('headerSegments', () => {
  it('labels months, quarters or years and covers the whole window exactly', () => {
    for (const zoom of ['month', 'quarter', 'year'] as const) {
      const w = timelineWindow('2026-11-01', zoom)
      const segs = headerSegments(w, zoom)
      expect(segs.reduce((n, x) => n + x.width, 0)).toBeCloseTo(100)
      expect(segs[0]!.left).toBe(0)
    }
    expect(headerSegments(timelineWindow('2026-11-01', 'month'), 'month')[0]!.label).toBe(
      'Nov 2026',
    )
    expect(
      headerSegments(timelineWindow('2026-11-01', 'quarter'), 'quarter')
        .slice(0, 2)
        .map((s) => s.label),
    ).toEqual(['Q4 2026', 'Q1 2027'])
    expect(
      headerSegments(timelineWindow('2026-11-01', 'year'), 'year').map((s) => s.label),
    ).toEqual(['2026', '2027', '2028', '2029'])
  })
})

describe('swimlanes', () => {
  const initiatives = [ini('a', { order: 1 }), ini('b', { order: 2 }), ini('c', { order: 3 })]
  it('has a lane per initiative that is on the roadmap or has features on it, and one for loose features', () => {
    const rows = buildRows(
      roadmap([entry('initiative', 'a', 1), entry('feature', 'f1', 2), entry('feature', 'f2', 3)]),
      initiatives,
      [feat('f1', { initiativeId: 'b' }), feat('f2')],
    )
    const lanes = swimlanes(rows, initiatives)
    expect(lanes.map((l) => l.id)).toEqual(['a', 'b', 'none'])
    expect(lanes[0]!.own).toBeTruthy()
    expect(lanes[1]!.own).toBeUndefined() // b has a feature on the roadmap but is not itself on it
    expect(lanes[1]!.features).toHaveLength(1)
  })
})

describe('links', () => {
  it('only draws links whose ends are both in the view', () => {
    const dep = (from: string, to: string): Dependency => ({
      ...stamp,
      id: from + to,
      fromType: 'initiative',
      fromId: from,
      toType: 'initiative',
      toId: to,
      kind: 'blocks',
    })
    const k = new Set([rowKey('initiative', 'a'), rowKey('initiative', 'b')])
    expect(visibleLinks([dep('a', 'b'), dep('a', 'z')], k)).toHaveLength(1)
  })
})
