import type { Objective, Outcome } from './v1'

/** 0 to 1: how far `current` has moved from `baseline` towards `target`. Works for targets below the baseline. */
export function outcomeProgress(o: Pick<Outcome, 'baseline' | 'target' | 'current'>): number {
  const span = o.target - o.baseline
  if (span === 0) return 0
  return Math.min(1, Math.max(0, (o.current - o.baseline) / span))
}

/** Average progress across an objective's outcomes, or undefined when it has none to measure. */
export function objectiveProgress(o: Pick<Objective, 'outcomes'>): number | undefined {
  const outcomes = o.outcomes ?? []
  if (outcomes.length === 0) return undefined
  return outcomes.reduce((sum, x) => sum + outcomeProgress(x), 0) / outcomes.length
}

export const asPercent = (progress: number) => Math.round(progress * 100)
