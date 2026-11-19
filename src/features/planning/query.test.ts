import { describe, expect, it } from 'vitest'
import type { Feature, Initiative, Objective, Tag } from '@/domain'
import {
  EMPTY_FILTERS,
  NONE,
  activeFilterCount,
  filterFeatures,
  filterInitiatives,
  filterObjectives,
  sortItems,
  type Filters,
} from './query'

const stamp = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  productId: 'p',
}
const obj = (id: string, title: string, over: Partial<Objective> = {}): Objective => ({
  ...stamp,
  id,
  title,
  status: 'active',
  order: 1,
  ...over,
})
const ini = (id: string, title: string, over: Partial<Initiative> = {}): Initiative => ({
  ...stamp,
  id,
  title,
  status: 'idea',
  tagIds: [],
  order: 1,
  ...over,
})
const feat = (id: string, title: string, over: Partial<Feature> = {}): Feature => ({
  ...stamp,
  id,
  title,
  status: 'idea',
  tagIds: [],
  order: 1,
  ...over,
})
const tag = (id: string, name: string): Tag => ({ ...stamp, id, name, tone: 'neutral' })
const f = (over: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...over })

const objectives = [obj('o1', 'Grow users', { order: 1 }), obj('o2', 'Earn revenue', { order: 2 })]
const tags = [tag('t1', 'Growth'), tag('t2', 'Bug')]
const initiatives = [
  ini('i1', 'Beta programme', {
    objectiveId: 'o1',
    status: 'in-progress',
    priority: 'high',
    owner: 'Sam',
    tagIds: ['t1'],
    order: 1,
    scoring: { impact: 5, effort: 3 },
  }),
  ini('i2', 'Billing', {
    objectiveId: 'o2',
    status: 'planned',
    priority: 'critical',
    order: 2,
    scoring: { impact: 4, effort: 5 },
  }),
  ini('i3', 'Cleanup', { status: 'idea', order: 3 }),
]
const features = [
  feat('f1', 'Invite flow', { initiativeId: 'i1', priority: 'high', tagIds: ['t1'], order: 1 }),
  feat('f2', 'Checkout', { initiativeId: 'i2', status: 'planned', order: 2 }),
  feat('f3', 'Loose idea', { order: 3 }),
]
const ctx = { objectives, initiatives, tags }
const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('filterInitiatives', () => {
  it('returns everything in manual order by default', () => {
    expect(ids(filterInitiatives(initiatives, ctx, EMPTY_FILTERS))).toEqual(['i1', 'i2', 'i3'])
  })
  it('searches title, description, owner, objective title and tag names, ignoring case', () => {
    expect(ids(filterInitiatives(initiatives, ctx, f({ q: 'BETA' })))).toEqual(['i1'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ q: 'sam' })))).toEqual(['i1'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ q: 'revenue' })))).toEqual(['i2'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ q: 'growth' })))).toEqual(['i1'])
    expect(filterInitiatives(initiatives, ctx, f({ q: 'zzz' }))).toEqual([])
  })
  it('filters by status, priority (including not set), objective (including none) and tag', () => {
    expect(ids(filterInitiatives(initiatives, ctx, f({ status: 'planned' })))).toEqual(['i2'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ priority: 'critical' })))).toEqual(['i2'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ priority: NONE })))).toEqual(['i3'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ objective: 'o1' })))).toEqual(['i1'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ objective: NONE })))).toEqual(['i3'])
    expect(ids(filterInitiatives(initiatives, ctx, f({ tag: 't1' })))).toEqual(['i1'])
  })
  it('combines filters', () => {
    expect(
      ids(filterInitiatives(initiatives, ctx, f({ objective: 'o1', status: 'planned' }))),
    ).toEqual([])
  })
})

describe('filterFeatures', () => {
  it('filters by initiative, and by objective through the initiative', () => {
    expect(ids(filterFeatures(features, ctx, f({ initiative: 'i1' })))).toEqual(['f1'])
    expect(ids(filterFeatures(features, ctx, f({ initiative: NONE })))).toEqual(['f3'])
    expect(ids(filterFeatures(features, ctx, f({ objective: 'o2' })))).toEqual(['f2'])
    expect(ids(filterFeatures(features, ctx, f({ objective: NONE })))).toEqual(['f3'])
  })
  it('searches the parent initiative title too', () => {
    expect(ids(filterFeatures(features, ctx, f({ q: 'billing' })))).toEqual(['f2'])
  })
  it('filters by tag, status and priority', () => {
    expect(ids(filterFeatures(features, ctx, f({ tag: 't1' })))).toEqual(['f1'])
    expect(ids(filterFeatures(features, ctx, f({ status: 'planned' })))).toEqual(['f2'])
    expect(ids(filterFeatures(features, ctx, f({ priority: 'high' })))).toEqual(['f1'])
  })
})

describe('filterObjectives', () => {
  it('searches title and outcomes, and filters by status', () => {
    const withOutcome = [
      obj('o1', 'Grow', {
        outcomes: [
          { id: 'x', title: 'Weekly users', metric: 'WAU', baseline: 0, target: 10, current: 2 },
        ],
      }),
      obj('o2', 'Other', { status: 'achieved' }),
    ]
    expect(ids(filterObjectives(withOutcome, f({ q: 'wau' })))).toEqual(['o1'])
    expect(ids(filterObjectives(withOutcome, f({ status: 'achieved' })))).toEqual(['o2'])
  })
  it('sorts by target date with undated last, and by progress with unmeasured last', () => {
    const o = (id: string, targetDate: string | undefined, current?: number) =>
      obj(id, id, {
        targetDate,
        order: Number(id.slice(1)),
        outcomes:
          current === undefined
            ? undefined
            : [{ id: id, title: 't', baseline: 0, target: 10, current }],
      })
    const list = [o('o1', undefined), o('o2', '2026-12-01', 8), o('o3', '2026-06-01', 2)]
    expect(ids(filterObjectives(list, f({ sort: 'target' })))).toEqual(['o3', 'o2', 'o1'])
    expect(ids(filterObjectives(list, f({ sort: 'progress' })))).toEqual(['o3', 'o2', 'o1'])
  })
})

describe('sortItems', () => {
  it('sorts by priority with unset last, ties by manual order', () => {
    expect(ids(sortItems(initiatives, 'priority'))).toEqual(['i2', 'i1', 'i3'])
  })
  it('sorts by impact descending and effort ascending, unset last', () => {
    expect(ids(sortItems(initiatives, 'impact'))).toEqual(['i1', 'i2', 'i3'])
    expect(ids(sortItems(initiatives, 'effort'))).toEqual(['i1', 'i2', 'i3'])
  })
  it('sorts active work first by status', () => {
    expect(ids(sortItems(initiatives, 'status'))).toEqual(['i1', 'i2', 'i3'])
  })
  it('sorts titles without regard to case and does not mutate its input', () => {
    const input = [ini('a', 'banana'), ini('b', 'Apple'), ini('c', 'cherry')]
    expect(ids(sortItems(input, 'title'))).toEqual(['b', 'a', 'c'])
    expect(ids(input)).toEqual(['a', 'b', 'c'])
  })
  it('sorts by recently updated', () => {
    const input = [
      ini('a', 'a', { updatedAt: '2026-01-02T00:00:00.000Z' }),
      ini('b', 'b', { updatedAt: '2026-03-01T00:00:00.000Z' }),
    ]
    expect(ids(sortItems(input, 'updated'))).toEqual(['b', 'a'])
  })
})

describe('activeFilterCount', () => {
  it('counts narrowing filters but not sort, and ignores blank search', () => {
    expect(activeFilterCount(f({ sort: 'title', q: '  ' }))).toBe(0)
    expect(activeFilterCount(f({ q: 'x', status: 'idea', tag: 't1' }))).toBe(3)
  })
})
