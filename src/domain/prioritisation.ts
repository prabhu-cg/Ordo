import type { Level, Quadrant } from './schema'

/**
 * The impact and effort matrix.
 *
 *            effort low        effort medium      effort high
 *  impact high  quick win        quick win         major project
 *  impact medium quick win       major project     major project
 *  impact low   fill-in          fill-in           reconsider
 *
 * Medium sits on the line, so it is placed by what it is combined with: a medium-impact item is a quick win only
 * when it is also low effort, and a high-impact one stays a quick win at medium effort. A person can always
 * place an item by hand (an override); the matrix never changes an item's priority.
 */
export function quadrantOf(
  impact: Level | undefined,
  effort: Level | undefined,
): Quadrant | undefined {
  if (!impact || !effort) return undefined
  if (impact === 'low') return effort === 'high' ? 'reconsider' : 'fill-ins'
  if (effort === 'low' || (impact === 'high' && effort === 'medium')) return 'quick-wins'
  return 'major-projects'
}

interface Scored {
  scoring?: { impact?: Level; effort?: Level }
  matrixOverride?: Quadrant
}

/** Where an item shows on the matrix: the manual placement if there is one, otherwise what its scores give. */
export const placement = (item: Scored): { quadrant: Quadrant; manual: boolean } | undefined => {
  if (item.matrixOverride) return { quadrant: item.matrixOverride, manual: true }
  const q = quadrantOf(item.scoring?.impact, item.scoring?.effort)
  return q ? { quadrant: q, manual: false } : undefined
}

export const QUADRANT_INFO: Record<Quadrant, { label: string; blurb: string; rule: string }> = {
  'quick-wins': {
    label: 'Quick wins',
    blurb: 'Good return for little work. Usually first.',
    rule: 'High impact for low or medium effort, or medium impact for low effort.',
  },
  'major-projects': {
    label: 'Major projects',
    blurb: 'Worth doing, but they take real effort. Plan them.',
    rule: 'High or medium impact that needs medium or high effort.',
  },
  'fill-ins': {
    label: 'Fill-ins',
    blurb: 'Small and low value. Do when there is a gap.',
    rule: 'Low impact for low or medium effort.',
  },
  reconsider: {
    label: 'Reconsider',
    blurb: 'A lot of work for little return. Question whether to do it.',
    rule: 'Low impact for high effort.',
  },
}
