import {
  HORIZON_MONTHS,
  newId,
  type Draft,
  type Product,
  type ProductBundle,
  type TemplateDefinition,
} from '@/domain'

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
  /**
   * Whether the records are examples. True for a built-in template: the product is marked as holding sample data
   * until the user says otherwise. False for a custom template, which is the person's own structure.
   */
  sample?: boolean
}

/**
 * Turn a template, built-in or custom, into a fresh, fully-linked set of records with new ids and real dates.
 * Pure: it never touches storage and never changes the template. Calling it twice gives two independent copies.
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

  const scoring = (impact?: 'low' | 'medium' | 'high', effort?: 'low' | 'medium' | 'high') =>
    impact || effort ? { ...(impact ? { impact } : {}), ...(effort ? { effort } : {}) } : undefined
  const dates = (months?: [number, number]) =>
    months
      ? { startDate: firstOfMonth(anchor, months[0]), endDate: lastOfMonth(anchor, months[1]) }
      : {}

  const initiatives = template.initiatives.map((i, index) => ({
    ...common,
    id: initiativeIds.get(i.key)!,
    objectiveId: i.objective ? objectiveIds.get(i.objective) : undefined,
    title: i.title,
    description: i.description,
    status: i.status,
    priority: i.priority,
    confidence: i.confidence,
    owner: i.owner,
    scoring: scoring(i.impact, i.effort),
    tagIds: (i.tags ?? [])
      .map((name) => tagIds.get(name))
      .filter((id): id is string => Boolean(id)),
    ...dates(i.months),
    order: index + 1,
  }))

  const roadmapId = newId()
  const { structure } = template
  return {
    product: {
      id: productId,
      category: template.category,
      planningHorizon: structure.horizon,
      ...(options.sample === false ? {} : { sampleData: true, templateName: template.name }),
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
        priority: f.priority,
        confidence: f.confidence,
        scoring: scoring(f.impact, f.effort),
        tagIds: (f.tags ?? [])
          .map((name) => tagIds.get(name))
          .filter((id): id is string => Boolean(id)),
        ...dates(f.months),
        order: index + 1,
      })),
    ),
    milestones: template.milestones.map((m) => ({
      ...common,
      id: newId(),
      initiativeId: m.initiative ? initiativeIds.get(m.initiative) : undefined,
      title: m.title,
      description: m.description,
      date: lastOfMonth(anchor, m.month),
      status: 'upcoming' as const,
    })),
    dependencies: template.initiatives.flatMap((i) =>
      (i.links ?? []).map((l) => ({
        ...common,
        id: newId(),
        fromType: 'initiative' as const,
        fromId: initiativeIds.get(i.key)!,
        toType: 'initiative' as const,
        toId: initiativeIds.get(l.to)!,
        kind: l.kind,
        note: l.note,
      })),
    ),
    roadmap: {
      ...common,
      id: roadmapId,
      name: 'Roadmap',
      planningHorizon: structure.horizon,
      defaultView: structure.defaultView,
      planningMode: structure.planningMode,
      itemTypes: structure.itemTypes,
      // Placement only: dates belong to the initiatives themselves.
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
  return HORIZON_MONTHS[template.structure.horizon]
}
