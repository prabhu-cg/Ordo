import { z } from 'zod'
import {
  baseShape,
  calendarDay,
  endAfterStart,
  END_AFTER_START_MESSAGE,
  ENTITY_TYPES,
  idSchema,
  isoDate,
  laneSchema,
  longText,
  planningHorizonSchema,
  confidenceSchema,
  planningModeSchema,
  quadrantSchema,
  prioritySchema,
  roadmapItemTypeSchema,
  productCategorySchema,
  scoringSchema,
  softDeleteShape,
  title,
  workStatusSchema,
} from './common'

/**
 * Ownership tree (all ids are opaque strings):
 *
 *   Product ─┬─ Objective ── Initiative ── Feature
 *            ├─ Milestone  (standalone, or linked to an Initiative)
 *            ├─ Roadmap ── RoadmapEntry[] ──▶ Initiative | Feature   (references, never copies)
 *            │      └─ RoadmapView[]  (a way of looking at one roadmap)
 *            ├─ Tag        (referenced by Initiative.tagIds / Feature.tagIds)
 *            ├─ Dependency (between any two initiatives/features)
 *            └─ Revision   (append-only history)
 */

// ── Product ────────────────────────────────────────────────────────────────
export const productSchema = z.object({
  ...baseShape,
  ...softDeleteShape,
  name: title(80),
  tagline: longText(140).optional(),
  description: longText(1000).optional(),
  vision: longText(1000).optional(),
  targetAudience: longText(500).optional(),
  // Added after the first release as optional fields: older records and backups remain valid.
  category: productCategorySchema.optional(),
  planningHorizon: planningHorizonSchema.optional(),
  /** Set when the product was started from a template: its records are examples until the user says otherwise. */
  sampleData: z.boolean().optional(),
  templateName: longText(120).optional(),
})
export type Product = z.infer<typeof productSchema>

// ── Objective ──────────────────────────────────────────────────────────────
export const OBJECTIVE_STATUSES = ['active', 'achieved', 'dropped'] as const

/**
 * A measurable result of an objective: what you will measure, where it started, where it should get to,
 * and where it is now. Progress is derived (see progress.ts), never stored.
 */
const finite = (label: string) =>
  z.number({ error: `${label} must be a number` }).finite(`${label} must be a number`)
export const outcomeSchema = z
  .object({
    id: idSchema,
    title: title(140),
    metric: longText(100).optional(),
    unit: longText(24).optional(),
    baseline: finite('Baseline'),
    target: finite('Target'),
    current: finite('Current value'),
  })
  .refine((o) => o.target !== o.baseline, {
    message: 'The target must differ from the baseline',
    path: ['target'],
  })
export type Outcome = z.infer<typeof outcomeSchema>

export const objectiveSchema = z.object({
  ...baseShape,
  ...softDeleteShape,
  productId: idSchema,
  title: title(),
  description: longText().optional(),
  status: z.enum(OBJECTIVE_STATUSES),
  targetDate: calendarDay.optional(),
  /** Added after the first release as optional: older records and backups remain valid. */
  outcomes: z.array(outcomeSchema).optional(),
  order: z.number(),
})
export type Objective = z.infer<typeof objectiveSchema>

// ── Initiative ─────────────────────────────────────────────────────────────
export const initiativeSchema = z
  .object({
    ...baseShape,
    ...softDeleteShape,
    productId: idSchema,
    objectiveId: idSchema.optional(), // optional: progressive disclosure, strategy can come later
    title: title(),
    description: longText().optional(),
    status: workStatusSchema,
    scoring: scoringSchema.optional(),
    priority: prioritySchema.optional(),
    confidence: confidenceSchema.optional(),
    /** A manual placement on the impact and effort matrix, in place of the one the scores give. */
    matrixOverride: quadrantSchema.optional(),
    owner: longText(80).optional(),
    tagIds: z.array(idSchema),
    startDate: calendarDay.optional(),
    endDate: calendarDay.optional(),
    order: z.number(),
  })
  .refine(endAfterStart, END_AFTER_START_MESSAGE)
export type Initiative = z.infer<typeof initiativeSchema>

// ── Feature ────────────────────────────────────────────────────────────────
export const featureSchema = z
  .object({
    ...baseShape,
    ...softDeleteShape,
    productId: idSchema,
    initiativeId: idSchema.optional(),
    title: title(),
    description: longText().optional(),
    status: workStatusSchema,
    scoring: scoringSchema.optional(),
    priority: prioritySchema.optional(),
    confidence: confidenceSchema.optional(),
    /** A manual placement on the impact and effort matrix, in place of the one the scores give. */
    matrixOverride: quadrantSchema.optional(),
    owner: longText(80).optional(),
    tagIds: z.array(idSchema),
    startDate: calendarDay.optional(),
    endDate: calendarDay.optional(),
    order: z.number(),
  })
  .refine(endAfterStart, END_AFTER_START_MESSAGE)
export type Feature = z.infer<typeof featureSchema>

// ── Milestone ──────────────────────────────────────────────────────────────
export const MILESTONE_STATUSES = ['upcoming', 'reached', 'missed'] as const
export const milestoneSchema = z.object({
  ...baseShape,
  ...softDeleteShape,
  productId: idSchema,
  initiativeId: idSchema.optional(), // standalone when absent
  title: title(),
  description: longText().optional(),
  date: calendarDay,
  status: z.enum(MILESTONE_STATUSES),
})
export type Milestone = z.infer<typeof milestoneSchema>

// ── Roadmap ────────────────────────────────────────────────────────────────
/**
 * Where an initiative or feature sits on a roadmap. It points at the record; it never copies it.
 * It holds only what is specific to this roadmap: the lane and the order. Dates, status and priority
 * belong to the initiative or feature itself, so every roadmap and view agrees on them.
 * (`startDate` and `endDate` are kept for older data and are no longer read or written.)
 */
export const roadmapEntrySchema = z
  .object({
    itemType: z.enum(['initiative', 'feature']),
    itemId: idSchema,
    lane: laneSchema.optional(),
    startDate: calendarDay.optional(),
    endDate: calendarDay.optional(),
    order: z.number(),
  })
  .refine(endAfterStart, END_AFTER_START_MESSAGE)
export type RoadmapEntry = z.infer<typeof roadmapEntrySchema>

export const TONES = ['neutral', 'amber', 'success', 'info', 'warning', 'destructive'] as const
export const toneSchema = z.enum(TONES)
export type Tone = z.infer<typeof toneSchema>

export const roadmapSchema = z.object({
  ...baseShape,
  ...softDeleteShape,
  productId: idSchema,
  name: title(80),
  description: longText().optional(),
  entries: z.array(roadmapEntrySchema),
  // Added after the first release as optional: older roadmaps and backups remain valid.
  planningHorizon: planningHorizonSchema.optional(),
  defaultView: z.enum(['now-next-later', 'timeline', 'board']).optional(),
  planningMode: planningModeSchema.optional(),
  /** What this roadmap shows. Absent means initiatives, features and milestones. */
  itemTypes: z.array(roadmapItemTypeSchema).min(1, 'Show at least one kind of item').optional(),
  /** The roadmap's own colour, shown on its cards and in exports. Absent means no accent. */
  color: toneSchema.optional(),
})
export type Roadmap = z.infer<typeof roadmapSchema>

// ── RoadmapView ────────────────────────────────────────────────────────────
export const VIEW_LAYOUTS = ['now-next-later', 'timeline', 'board', 'table'] as const
export const roadmapViewSchema = z.object({
  ...baseShape,
  productId: idSchema,
  roadmapId: idSchema,
  name: title(60),
  layout: z.enum(VIEW_LAYOUTS),
  config: z
    .object({
      groupBy: z.enum(['status', 'priority', 'initiative', 'objective', 'lane', 'tag']).optional(),
      sort: z.enum(['manual', 'priority', 'title', 'updated', 'impact', 'effort']).optional(),
      /** Which details a board card shows. */
      cardFields: z
        .array(
          z.enum([
            'priority',
            'confidence',
            'dependencies',
            'owner',
            'dates',
            'tags',
            'objective',
            'impact',
            'effort',
          ]),
        )
        .optional(),
      showDependencies: z.boolean().optional(),
      statuses: z.array(workStatusSchema).optional(),
      tagIds: z.array(idSchema).optional(),
      showMilestones: z.boolean().optional(),
      zoom: z.enum(['month', 'quarter', 'year']).optional(),
    })
    .default({}),
  order: z.number(),
})
export type RoadmapView = z.infer<typeof roadmapViewSchema>

// ── Tag ────────────────────────────────────────────────────────────────────
export const TAG_TONES = ['neutral', 'amber', 'success', 'info', 'warning', 'destructive'] as const
export const tagSchema = z.object({
  ...baseShape,
  ...softDeleteShape,
  productId: idSchema,
  name: title(40),
  tone: z.enum(TAG_TONES),
})
export type Tag = z.infer<typeof tagSchema>

// ── Dependency ─────────────────────────────────────────────────────────────
export const DEPENDENCY_KINDS = ['blocks', 'relates'] as const
const dependable = z.enum(['initiative', 'feature'])
export const dependencySchema = z
  .object({
    ...baseShape,
    productId: idSchema,
    fromType: dependable,
    fromId: idSchema,
    toType: dependable,
    toId: idSchema,
    kind: z.enum(DEPENDENCY_KINDS),
    note: longText(300).optional(),
  })
  .refine((d) => !(d.fromType === d.toType && d.fromId === d.toId), {
    message: 'An item cannot depend on itself',
    path: ['toId'],
  })
export type Dependency = z.infer<typeof dependencySchema>

// ── Revision ───────────────────────────────────────────────────────────────
export const REVISION_ACTIONS = ['create', 'update', 'delete', 'restore'] as const
export const revisionSchema = z.object({
  id: idSchema,
  createdAt: isoDate,
  productId: idSchema,
  entityType: z.enum(ENTITY_TYPES),
  entityId: idSchema,
  action: z.enum(REVISION_ACTIONS),
  /** The record as it stood immediately after the action. */
  snapshot: z.record(z.string(), z.unknown()),
})
export type Revision = z.infer<typeof revisionSchema>
