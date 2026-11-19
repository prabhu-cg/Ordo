import { describe, expect, it } from 'vitest'
import { LEVELS } from './schema'
import { placement, quadrantOf } from './prioritisation'
import { confidenceFromScore, levelFromScore, migrateWorkItemV1 } from './schema/migrate'

describe('the impact and effort matrix', () => {
  const grid = (impact: 'low' | 'medium' | 'high', effort: 'low' | 'medium' | 'high') =>
    quadrantOf(impact, effort)
  it('places all nine combinations', () => {
    expect([grid('high', 'low'), grid('high', 'medium'), grid('medium', 'low')]).toEqual([
      'quick-wins',
      'quick-wins',
      'quick-wins',
    ])
    expect([grid('high', 'high'), grid('medium', 'medium'), grid('medium', 'high')]).toEqual([
      'major-projects',
      'major-projects',
      'major-projects',
    ])
    expect([grid('low', 'low'), grid('low', 'medium')]).toEqual(['fill-ins', 'fill-ins'])
    expect(grid('low', 'high')).toBe('reconsider')
  })
  it('puts every combination in exactly one quadrant, and each of the four is reachable', () => {
    const all = LEVELS.flatMap((i) => LEVELS.map((e) => quadrantOf(i, e)))
    expect(all).toHaveLength(9)
    expect(new Set(all).size).toBe(4)
  })
  it('more impact never moves an item to a worse area, and more effort never to a better one', () => {
    const rank = { 'quick-wins': 0, 'major-projects': 1, 'fill-ins': 2, reconsider: 3 } as const
    // For a given effort, raising impact must not land in fill-ins/reconsider after being in a quick win/major project.
    for (const e of LEVELS) {
      const q = LEVELS.map((i) => quadrantOf(i, e)!)
      expect(
        ['fill-ins', 'reconsider'].includes(q[0]!) || !['fill-ins', 'reconsider'].includes(q[1]!),
      ).toBe(true)
      expect(rank[q[2]!] <= 1).toBe(true)
    }
  })
  it('has no quadrant until both scores are set', () => {
    expect(quadrantOf(undefined, 'low')).toBeUndefined()
    expect(quadrantOf('high', undefined)).toBeUndefined()
  })
  it('a manual placement wins over the scores, and says it is manual', () => {
    expect(placement({ scoring: { impact: 'high', effort: 'low' } })).toEqual({
      quadrant: 'quick-wins',
      manual: false,
    })
    expect(
      placement({ scoring: { impact: 'high', effort: 'low' }, matrixOverride: 'reconsider' }),
    ).toEqual({ quadrant: 'reconsider', manual: true })
    expect(placement({ matrixOverride: 'fill-ins' })).toEqual({
      quadrant: 'fill-ins',
      manual: true,
    }) // unscored but placed by hand
    expect(placement({})).toBeUndefined()
  })
})

describe('migrating version 1 scores', () => {
  it('maps 1 to 5 onto low, medium and high', () => {
    expect([1, 2, 3, 4, 5].map(levelFromScore)).toEqual(['low', 'low', 'medium', 'high', 'high'])
    expect([1, 2, 3, 4, 5].map(confidenceFromScore)).toEqual([
      'exploring',
      'exploring',
      'tentative',
      'committed',
      'committed',
    ])
    expect(levelFromScore(undefined)).toBeUndefined()
    expect(levelFromScore('high')).toBe('high') // already migrated
  })
  it('moves confidence out of scoring and leaves everything else alone', () => {
    const out = migrateWorkItemV1({
      id: 'a',
      title: 'T',
      scoring: { impact: 4, effort: 1, confidence: 5 },
      priority: 'high',
    })
    expect(out).toEqual({
      id: 'a',
      title: 'T',
      scoring: { impact: 'high', effort: 'low' },
      confidence: 'committed',
      priority: 'high',
    })
  })
  it('drops an empty scoring and is safe to run twice', () => {
    expect(migrateWorkItemV1({ id: 'a', scoring: {} })).toEqual({ id: 'a' })
    const once = migrateWorkItemV1({ id: 'a', scoring: { impact: 3, confidence: 3 } })
    expect(migrateWorkItemV1(once)).toEqual(once)
    const untouched = { id: 'b', title: 'No scoring' }
    expect(migrateWorkItemV1(untouched)).toBe(untouched)
  })
})
