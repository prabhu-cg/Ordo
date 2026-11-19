import { HORIZON_MONTHS, newId, type Draft, type Product, type ProductBundle } from '@/domain'
import type { TemplateDefinition } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
const day = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const firstOfMonth = (anchor: Date, offset: number) =>
  day(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1)))
const lastOfMonth = (anchor: Date, offset: number) =>
  day(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset + 1, 0)))

export interface ResolveOptions {
  /** Fields for the new product. `name` is required; category and horizon default to the template's. */
  product: Pick<Draft<Product>, 'name'> & Partial<Omit<Draft<Product>, 'id' | 'name'>>
  /** The month the plan starts in. Defaults to now. */
  anchor?: Date
}

/**
 * Turn a read-only template into a fresh, fully-linked set of records with new ids and real dates.
 * Pure: it never touches storage, and calling it twice gives two independent copies.
 */
export function resolveTemplate(
  template: TemplateDefinition,
  options: ResolveOptions,
): ProductBundle {
  const anchor = options.anchor ?? new Date()
  const productId = newId()
  const common = { productId }

  const tagIds = new Map(template.tags.map((t) => [t.name, newId()]))
  const objectiveIds = new Map(template.objectives.map((o) => [o.key, newId()]))
  const initiativeIds = new Map(template.initiatives.map((i) => [i.key, newId()]))

  const initiatives = template.initiatives.map((i, index) => ({
    ...common,
    id: initiativeIds.get(i.key)!,
    objectiveId: objectiveIds.get(i.objective),
    title: i.title,
    description: i.description,
    status: i.status,
    scoring: { ...i.scoring },
    tagIds: (i.tags ?? [])
      .map((name) => tagIds.get(name))
      .filter((id): id is string => Boolean(id)),
    startDate: firstOfMonth(anchor, i.months[0]),
    endDate: lastOfMonth(anchor, i.months[1]),
    order: index + 1,
  }))

  const roadmapId = newId()
  return {
    product: {
      id: productId,
      category: template.category,
      planningHorizon: template.horizon,
      ...options.product,
    },
    tags: template.tags.map((t) => ({
      ...common,
      id: tagIds.get(t.name)!,
      name: t.name,
      tone: t.tone,
    })),
    objectives: template.objectives.map((o, index) => ({
      ...common,
      id: objectiveIds.get(o.key)!,
      title: o.title,
      description: o.description,
      status: 'active' as const,
      order: index + 1,
    })),
    initiatives,
    features: template.initiatives.flatMap((i) =>
      i.features.map((f, index) => ({
        ...common,
        id: newId(),
        initiativeId: initiativeIds.get(i.key),
        title: f.title,
        description: f.description,
        status: f.status,
        tagIds: [],
        order: index + 1,
      })),
    ),
    milestones: template.milestones.map((m) => ({
      ...common,
      id: newId(),
      initiativeId: m.initiative ? initiativeIds.get(m.initiative) : undefined,
      title: m.title,
      date: lastOfMonth(anchor, m.month),
      status: 'upcoming' as const,
    })),
    dependencies: [],
    roadmap: {
      ...common,
      id: roadmapId,
      name: 'Roadmap',
      entries: template.initiatives.map((i, index) => ({
        itemType: 'initiative' as const,
        itemId: initiativeIds.get(i.key)!,
        lane: i.lane,
        order: index + 1,
      })),
    },
    // Three views over one roadmap: they point at the same records.
    views: (['now-next-later', 'timeline', 'board'] as const).map((layout, index) => ({
      ...common,
      id: newId(),
      roadmapId,
      name: { 'now-next-later': 'Now, next, later', timeline: 'Timeline', board: 'Board' }[layout],
      layout,
      config: {},
      order: index + 1,
    })),
  }
}

/** Months the template spans, for display. */
export function templateHorizonMonths(template: TemplateDefinition): number {
  return HORIZON_MONTHS[template.horizon]
}
