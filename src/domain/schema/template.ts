import { z } from 'zod'
import { TAG_TONES } from './entities'
import {
  baseShape,
  confidenceSchema,
  levelSchema,
  laneSchema,
  longText,
  planningHorizonSchema,
  planningModeSchema,
  prioritySchema,
  productCategorySchema,
  roadmapItemTypeSchema,
  softDeleteShape,
  title,
  workStatusSchema,
} from './common'

/**
 * A starter roadmap as plain data. Built-in templates are written in code; custom ones are saved from a person's
 * own roadmap. Both have this shape, so one function turns either into a new product.
 *
 * Dates are month offsets from when the template is used (0 is this month), so a template is always current.
 */
const key = z.string().min(1).max(40)
const months = z
  .tuple([z.number().int().min(-24).max(60), z.number().int().min(-24).max(60)])
  .refine(([a, b]) => b >= a, 'The end month cannot be before the start month')

export const templateFeatureSchema = z.object({
  title: title(),
  description: longText().optional(),
  status: workStatusSchema,
  priority: prioritySchema.optional(),
  impact: levelSchema.optional(),
  effort: levelSchema.optional(),
  confidence: confidenceSchema.optional(),
  months: months.optional(),
  /** Names of tags defined by the template. */
  tags: z.array(z.string().min(1).max(40)).optional(),
})

export const templateInitiativeSchema = z.object({
  key,
  objective: key.optional(),
  title: title(),
  description: longText().optional(),
  status: workStatusSchema,
  lane: laneSchema,
  months: months.optional(),
  priority: prioritySchema.optional(),
  impact: levelSchema.optional(),
  effort: levelSchema.optional(),
  confidence: confidenceSchema.optional(),
  owner: longText(80).optional(),
  tags: z.array(z.string().min(1).max(40)).optional(),
  /** This initiative blocks (or relates to) another one, by key. */
  links: z
    .array(z.object({ to: key, kind: z.enum(['blocks', 'relates']), note: longText().optional() }))
    .optional(),
  features: z.array(templateFeatureSchema),
})

/** The suggested way to plan with this template: how its roadmap is set up. */
export const templateStructureSchema = z.object({
  planningMode: planningModeSchema,
  defaultView: z.enum(['now-next-later', 'timeline', 'board']),
  horizon: planningHorizonSchema,
  itemTypes: z.array(roadmapItemTypeSchema).min(1).optional(),
  /** One or two sentences on how to use it. */
  note: longText(400),
})

const shape = {
  name: title(80),
  summary: z
    .string()
    .trim()
    .min(1, 'Say what this template is for')
    .max(300, 'Keep it under 300 characters'),
  bestFor: z
    .string()
    .trim()
    .min(1, 'Say who this template suits')
    .max(200, 'Keep it under 200 characters'),
  category: productCategorySchema,
  structure: templateStructureSchema,
  tags: z.array(z.object({ name: title(40), tone: z.enum(TAG_TONES) })),
  objectives: z.array(z.object({ key, title: title(), description: longText().optional() })),
  initiatives: z.array(templateInitiativeSchema),
  milestones: z.array(
    z.object({
      title: title(),
      month: z.number().int().min(-24).max(60),
      initiative: key.optional(),
      description: longText().optional(),
    }),
  ),
}

/** Every reference inside a template must point at something in it, and keys must be unique. */
function checkReferences(
  t: {
    objectives: { key: string }[]
    initiatives: {
      key: string
      objective?: string
      links?: { to: string; kind: string }[]
      tags?: string[]
      features?: { tags?: string[] }[]
    }[]
    milestones: { initiative?: string }[]
    tags: { name: string }[]
  },
  ctx: z.RefinementCtx,
) {
  const issue = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: 'custom', message, path })
  const objectives = new Set<string>()
  t.objectives.forEach((o, i) => {
    if (objectives.has(o.key)) issue(`Duplicate objective key “${o.key}”`, ['objectives', i, 'key'])
    objectives.add(o.key)
  })
  const initiatives = new Set<string>()
  t.initiatives.forEach((x, i) => {
    if (initiatives.has(x.key))
      issue(`Duplicate initiative key “${x.key}”`, ['initiatives', i, 'key'])
    initiatives.add(x.key)
  })
  const tagNames = new Set(t.tags.map((x) => x.name))
  t.initiatives.forEach((x, i) => {
    if (x.objective && !objectives.has(x.objective))
      issue(`Unknown objective “${x.objective}”`, ['initiatives', i, 'objective'])
    x.links?.forEach((l, j) => {
      if (!initiatives.has(l.to))
        issue(`Unknown initiative “${l.to}”`, ['initiatives', i, 'links', j, 'to'])
      if (l.to === x.key)
        issue('An initiative cannot link to itself', ['initiatives', i, 'links', j, 'to'])
    })
    x.tags?.forEach((name, j) => {
      if (!tagNames.has(name)) issue(`Unknown tag “${name}”`, ['initiatives', i, 'tags', j])
    })
    x.features?.forEach((f, k) =>
      f.tags?.forEach((name, j) => {
        if (!tagNames.has(name))
          issue(`Unknown tag “${name}”`, ['initiatives', i, 'features', k, 'tags', j])
      }),
    )
  })
  t.milestones.forEach((m, i) => {
    if (m.initiative && !initiatives.has(m.initiative))
      issue(`Unknown initiative “${m.initiative}”`, ['milestones', i, 'initiative'])
  })
  // A "blocks" chain that loops back on itself could never be started.
  const blocks = new Map(
    t.initiatives.map((x) => [
      x.key,
      (x.links ?? []).filter((l) => l.kind === 'blocks').map((l) => l.to),
    ]),
  )
  const state = new Map<string, 1 | 2>()
  const visit = (k: string): boolean => {
    if (state.get(k) === 2) return false
    if (state.get(k) === 1) return true
    state.set(k, 1)
    const looped = (blocks.get(k) ?? []).some(visit)
    state.set(k, 2)
    return looped
  }
  for (const k of blocks.keys())
    if (visit(k)) return issue('The “blocks” links make a loop', ['initiatives'])
}

export const templateDefinitionSchema = z
  .object({ id: z.string().min(1).max(64), ...shape })
  .superRefine(checkReferences)
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>
export type TemplateInitiative = z.infer<typeof templateInitiativeSchema>
export type TemplateFeature = z.infer<typeof templateFeatureSchema>

/** A custom template as stored: a template plus ownership, timestamps and where it came from. */
export const templateRecordSchema = z
  .object({
    ...baseShape,
    ...softDeleteShape,
    ...shape,
    /** The template this was copied from, when it is a duplicate. */
    basedOn: longText(120).optional(),
  })
  .superRefine(checkReferences)
export type TemplateRecord = z.infer<typeof templateRecordSchema>
