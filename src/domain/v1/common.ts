import { z } from 'zod'

/** Current version of the domain schema. Bump when any persisted shape changes, and add a migration. */
export const SCHEMA_VERSION = 1

export const isoDate = z.iso.datetime({ offset: true })
/** A calendar day (YYYY-MM-DD), used for planning dates that have no time of day. */
export const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')

export const idSchema = z.string().min(1).max(64)

/** Fields every persisted record carries. */
export const baseShape = {
  id: idSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
}

/** Records that can be archived instead of destroyed. Absent means active. */
export const softDeleteShape = {
  deletedAt: isoDate.optional(),
}

export const title = (max = 120) =>
  z.string().trim().min(1, 'A name is required').max(max, `Keep it under ${max} characters`)
export const longText = (max = 2000) =>
  z.string().trim().max(max, `Keep it under ${max} characters`)

export const ENTITY_TYPES = [
  'product',
  'objective',
  'initiative',
  'feature',
  'milestone',
  'roadmap',
  'roadmapView',
  'tag',
  'dependency',
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

/** Lightweight prioritisation: 1 (low) to 5 (high). Effort 5 means a lot of work. */
const score = z.number().int().min(1).max(5)
export const scoringSchema = z.object({
  impact: score.optional(),
  confidence: score.optional(),
  effort: score.optional(),
})
export type Scoring = z.infer<typeof scoringSchema>

export const WORK_STATUSES = [
  'idea',
  'planned',
  'in-progress',
  'shipped',
  'paused',
  'dropped',
] as const
export const workStatusSchema = z.enum(WORK_STATUSES)
export type WorkStatus = z.infer<typeof workStatusSchema>

export const LANES = ['now', 'next', 'later'] as const
export const laneSchema = z.enum(LANES)
export type Lane = z.infer<typeof laneSchema>

/** Refine helper: an end date may not precede its start date. */
export function endAfterStart<T extends { startDate?: string; endDate?: string }>(v: T) {
  return !v.startDate || !v.endDate || v.endDate >= v.startDate
}
export const END_AFTER_START_MESSAGE = {
  message: 'The end date cannot be before the start date',
  path: ['endDate'],
}

export const PRODUCT_CATEGORIES = [
  'saas',
  'mobile-app',
  'developer-tool',
  'marketplace',
  'content',
  'hardware',
  'service',
  'other',
] as const
export const productCategorySchema = z.enum(PRODUCT_CATEGORIES)
export type ProductCategory = z.infer<typeof productCategorySchema>

export const PLANNING_HORIZONS = ['3-months', '6-months', '12-months', '2-years'] as const
export const planningHorizonSchema = z.enum(PLANNING_HORIZONS)
export type PlanningHorizon = z.infer<typeof planningHorizonSchema>
export const HORIZON_MONTHS: Record<PlanningHorizon, number> = {
  '3-months': 3,
  '6-months': 6,
  '12-months': 12,
  '2-years': 24,
}

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export const prioritySchema = z.enum(PRIORITIES)
export type Priority = z.infer<typeof prioritySchema>
