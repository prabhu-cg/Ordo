import { z } from 'zod'

/** Current version of the domain schema. Bump when any persisted shape changes, and add a migration. */
export const SCHEMA_VERSION = 2

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
  'template',
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

/**
 * Lightweight prioritisation: how much an item matters (impact) and how much work it is (effort), each low,
 * medium or high. Version 1 of the data used 1 to 5; see migrate.ts.
 */
export const LEVELS = ['low', 'medium', 'high'] as const
export const levelSchema = z.enum(LEVELS)
export type Level = z.infer<typeof levelSchema>

export const scoringSchema = z.object({
  impact: levelSchema.optional(),
  effort: levelSchema.optional(),
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

/** Flexible: lanes are yours to set and dates are optional. Dates: the lane follows each item's dates. */
export const PLANNING_MODES = ['flexible', 'dates'] as const
export const planningModeSchema = z.enum(PLANNING_MODES)
export type PlanningMode = z.infer<typeof planningModeSchema>

export const ROADMAP_ITEM_TYPES = ['initiative', 'feature', 'milestone'] as const
export const roadmapItemTypeSchema = z.enum(ROADMAP_ITEM_TYPES)
export type RoadmapItemType = z.infer<typeof roadmapItemTypeSchema>

/** How sure the plan is about an item. */
export const CONFIDENCE_LEVELS = ['exploring', 'tentative', 'committed'] as const
export const confidenceSchema = z.enum(CONFIDENCE_LEVELS)
export type Confidence = z.infer<typeof confidenceSchema>

/** The four areas of the impact and effort matrix. */
export const QUADRANTS = ['quick-wins', 'major-projects', 'fill-ins', 'reconsider'] as const
export const quadrantSchema = z.enum(QUADRANTS)
export type Quadrant = z.infer<typeof quadrantSchema>
