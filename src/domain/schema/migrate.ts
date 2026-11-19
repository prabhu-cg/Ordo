import { CONFIDENCE_LEVELS, LEVELS, type Confidence, type Level } from './common'

/**
 * Version 1 stored impact, effort and confidence as 1 to 5. Version 2 stores impact and effort as low, medium
 * or high, and confidence as exploring, tentative or committed. These functions turn the old numbers into the
 * new words. They are used by the database upgrade and by restoring an older backup.
 */
export function levelFromScore(n: unknown): Level | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n))
    return LEVELS.includes(n as Level) ? (n as Level) : undefined
  return n <= 2 ? 'low' : n === 3 ? 'medium' : 'high'
}

export function confidenceFromScore(n: unknown): Confidence | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n))
    return CONFIDENCE_LEVELS.includes(n as Confidence) ? (n as Confidence) : undefined
  return n <= 2 ? 'exploring' : n === 3 ? 'tentative' : 'committed'
}

/** Move one initiative or feature record from the version 1 shape to version 2. Already-migrated records pass through. */
export function migrateWorkItemV1<T extends Record<string, unknown>>(item: T): T {
  const old = item.scoring as
    { impact?: unknown; effort?: unknown; confidence?: unknown } | undefined
  if (!old || typeof old !== 'object') return item
  const impact = levelFromScore(old.impact)
  const effort = levelFromScore(old.effort)
  const confidence = item.confidence ?? confidenceFromScore(old.confidence)
  const scoring =
    impact || effort ? { ...(impact ? { impact } : {}), ...(effort ? { effort } : {}) } : undefined
  const next: Record<string, unknown> = { ...item, scoring }
  if (confidence) next.confidence = confidence
  if (!scoring) delete next.scoring
  return next as T
}
