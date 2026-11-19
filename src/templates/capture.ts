import {
  templateDefinitionSchema,
  type Dependency,
  type Feature,
  type Initiative,
  type Milestone,
  type Objective,
  type Product,
  type Roadmap,
  type Tag,
  type TemplateDefinition,
} from '@/domain'
import { monthStart, today } from '@/features/roadmap/dates'

export interface PlanSnapshot {
  product: Pick<Product, 'category' | 'planningHorizon'>
  roadmap: Roadmap
  objectives: Objective[]
  initiatives: Initiative[]
  features: Feature[]
  tags: Tag[]
  milestones: Milestone[]
  dependencies: Dependency[]
}

export interface CaptureInput {
  name: string
  summary: string
  bestFor: string
  note?: string
}

const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Turn the structure of one roadmap into a template: its initiatives, their features, the objectives they serve,
 * priorities, estimates, links, milestones, and how the roadmap is set up. It only reads. The plan it is taken
 * from is not changed, and nothing in the result points back at the plan's records.
 *
 * Dates become month offsets from the earliest date in the plan, so the template can be started in any month.
 * Owners are left out: a template is a structure to reuse, not a list of who does what.
 */
export function templateFromRoadmap(
  plan: PlanSnapshot,
  input: CaptureInput,
): Omit<TemplateDefinition, 'id'> {
  const onRoadmap = plan.roadmap.entries
    .filter((e) => e.itemType === 'initiative')
    .sort((a, b) => a.order - b.order)
  const initiatives = onRoadmap.flatMap((e) => {
    const i = plan.initiatives.find((x) => x.id === e.itemId && !x.deletedAt)
    return i ? [{ initiative: i, lane: e.lane }] : []
  })
  const keyOf = new Map(initiatives.map((x, index) => [x.initiative.id, `i${index + 1}`]))

  const dates = [
    ...initiatives.flatMap((x) => [x.initiative.startDate, x.initiative.endDate]),
    ...plan.milestones
      .filter((m) => !m.deletedAt && (!m.initiativeId || keyOf.has(m.initiativeId)))
      .map((m) => m.date),
  ].filter((d): d is string => Boolean(d))
  const base = dates.length
    ? monthIndex(dates.reduce((a, b) => (a < b ? a : b)))
    : monthIndex(monthStart(today()))
  const offset = (day: string) => clamp(monthIndex(day) - base, -24, 60)
  const range = (item: { startDate?: string; endDate?: string }): [number, number] | undefined => {
    const start = item.startDate ?? item.endDate
    const end = item.endDate ?? item.startDate
    return start && end ? [offset(start), Math.max(offset(start), offset(end))] : undefined
  }

  const objectiveIds = [
    ...new Set(
      initiatives.flatMap((x) => (x.initiative.objectiveId ? [x.initiative.objectiveId] : [])),
    ),
  ]
  const objectives = objectiveIds.flatMap((id, index) => {
    const o = plan.objectives.find((x) => x.id === id && !x.deletedAt)
    return o ? [{ key: `o${index + 1}`, id, title: o.title, description: o.description }] : []
  })
  const objectiveKey = new Map(objectives.map((o) => [o.id, o.key]))

  const featuresOf = (id: string) =>
    plan.features
      .filter((f) => f.initiativeId === id && !f.deletedAt)
      .sort((a, b) => a.order - b.order)
  const usedTags = [
    ...new Set(
      initiatives.flatMap((x) => [
        ...x.initiative.tagIds,
        ...featuresOf(x.initiative.id).flatMap((f) => f.tagIds),
      ]),
    ),
  ].flatMap((id) => {
    const t = plan.tags.find((x) => x.id === id && !x.deletedAt)
    return t ? [t] : []
  })

  const tagNames = (ids: string[]) =>
    ids.flatMap((id) => {
      const t = usedTags.find((x) => x.id === id)
      return t ? [t.name] : []
    })

  const links = (id: string) =>
    plan.dependencies
      .filter(
        (d) =>
          d.fromType === 'initiative' &&
          d.fromId === id &&
          d.toType === 'initiative' &&
          keyOf.has(d.toId),
      )
      .map((d) => ({
        to: keyOf.get(d.toId)!,
        kind: d.kind,
        ...(d.note ? { note: d.note } : {}),
      }))

  const definition: Omit<TemplateDefinition, 'id'> = {
    name: input.name.trim(),
    summary: input.summary.trim(),
    bestFor: input.bestFor.trim(),
    category: plan.product.category ?? 'other',
    structure: {
      planningMode: plan.roadmap.planningMode ?? 'flexible',
      defaultView: plan.roadmap.defaultView ?? 'now-next-later',
      horizon: plan.roadmap.planningHorizon ?? plan.product.planningHorizon ?? '6-months',
      ...(plan.roadmap.itemTypes ? { itemTypes: plan.roadmap.itemTypes } : {}),
      note: (input.note ?? '').trim() || `Saved from the roadmap “${plan.roadmap.name}”.`,
    },
    tags: usedTags.map((t) => ({ name: t.name, tone: t.tone })),
    objectives: objectives.map((o) => ({
      key: o.key,
      title: o.title,
      ...(o.description ? { description: o.description } : {}),
    })),
    initiatives: initiatives.map(({ initiative: i, lane }) => ({
      key: keyOf.get(i.id)!,
      ...(i.objectiveId && objectiveKey.has(i.objectiveId)
        ? { objective: objectiveKey.get(i.objectiveId) }
        : {}),
      title: i.title,
      ...(i.description ? { description: i.description } : {}),
      status: i.status,
      lane: lane ?? 'later',
      ...(range(i) ? { months: range(i) } : {}),
      ...(i.priority ? { priority: i.priority } : {}),
      ...(i.scoring?.impact ? { impact: i.scoring.impact } : {}),
      ...(i.scoring?.effort ? { effort: i.scoring.effort } : {}),
      ...(i.confidence ? { confidence: i.confidence } : {}),
      tags: tagNames(i.tagIds),
      links: links(i.id),
      features: featuresOf(i.id).map((f) => ({
        tags: tagNames(f.tagIds),
        title: f.title,
        ...(f.description ? { description: f.description } : {}),
        status: f.status,
        ...(f.priority ? { priority: f.priority } : {}),
        ...(f.scoring?.impact ? { impact: f.scoring.impact } : {}),
        ...(f.scoring?.effort ? { effort: f.scoring.effort } : {}),
        ...(f.confidence ? { confidence: f.confidence } : {}),
        ...(range(f) ? { months: range(f) } : {}),
      })),
    })),
    milestones: plan.milestones
      .filter((m) => !m.deletedAt && (!m.initiativeId || keyOf.has(m.initiativeId)))
      .map((m) => ({
        title: m.title,
        ...(m.description ? { description: m.description } : {}),
        month: offset(m.date),
        ...(m.initiativeId ? { initiative: keyOf.get(m.initiativeId)! } : {}),
      })),
  }
  // The result is checked like any template, so a bad capture is caught here and not when it is used.
  const parsed = templateDefinitionSchema.parse({ id: 'capture', ...definition })
  const { id: _id, ...content } = parsed
  void _id
  return content
}
