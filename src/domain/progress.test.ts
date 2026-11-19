import { describe, expect, it } from 'vitest'
import { asPercent, objectiveProgress, outcomeProgress } from './progress'

describe('outcomeProgress', () => {
  it('measures distance from baseline to target', () => {
    expect(outcomeProgress({ baseline: 0, target: 25, current: 10 })).toBeCloseTo(0.4)
    expect(outcomeProgress({ baseline: 10, target: 20, current: 15 })).toBe(0.5)
  })
  it('works when the target is below the baseline', () => {
    expect(outcomeProgress({ baseline: 100, target: 20, current: 60 })).toBe(0.5)
  })
  it('clamps to 0..1 and never divides by zero', () => {
    expect(outcomeProgress({ baseline: 0, target: 10, current: 40 })).toBe(1)
    expect(outcomeProgress({ baseline: 0, target: 10, current: -5 })).toBe(0)
    expect(outcomeProgress({ baseline: 5, target: 5, current: 9 })).toBe(0)
  })
})

describe('objectiveProgress', () => {
  it('averages outcomes and is undefined with none', () => {
    expect(objectiveProgress({})).toBeUndefined()
    expect(objectiveProgress({ outcomes: [] })).toBeUndefined()
    const o = (current: number) => ({
      id: String(current),
      title: 't',
      baseline: 0,
      target: 10,
      current,
    })
    expect(asPercent(objectiveProgress({ outcomes: [o(10), o(0)] })!)).toBe(50)
  })
})
