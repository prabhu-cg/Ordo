import type { Dependency, Feature, Initiative, Objective, Roadmap, Tag } from '@/domain'
import { STATUS_LABELS } from '@/lib/labels'

export interface PlanForCsv {
  objectives: Objective[]
  initiatives: Initiative[]
  features: Feature[]
  tags: Tag[]
  dependencies: Dependency[]
  /** Limit to this roadmap's items, with the parents and children that give them their place in the hierarchy. */
  roadmap?: Roadmap
}

export const CSV_COLUMNS = [
  'id',
  'parent_id',
  'type',
  'title',
  'status',
  'priority',
  'impact',
  'effort',
  'confidence',
  'start_date',
  'end_date',
  'lane',
  'on_roadmap',
  'owner',
  'tags',
  'blocks',
  'blocked_by',
  'description',
] as const

/**
 * A spreadsheet runs a cell that starts with = + - or @ as a formula. A title like "=HYPERLINK(...)" would then
 * run when the file is opened, so such a cell is made plain text with a leading apostrophe. Numbers and dates
 * are untouched, as they start with a digit.
 */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/** One CSV field: quoted when it holds a comma, quote or line break, with quotes doubled (RFC 4180). */
export function csvField(value: string): string {
  const v = safeCell(value)
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(header: readonly string[], rows: string[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvField).join(','))
  // The byte order mark makes Excel read the file as UTF-8, so accents and symbols survive.
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

const yes = (b: boolean) => (b ? 'yes' : 'no')

/**
 * The plan as rows. Hierarchy is kept with ids: an objective has no parent, an initiative's parent_id is its
 * objective, a feature's is its initiative. The words are the ones the app shows (Low, Medium, High…), and ids
 * are the real ids, so the file can be joined back to a JSON backup.
 */
export function planToRows(plan: PlanForCsv): string[][] {
  const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt)
  const onRoadmap = new Map(
    (plan.roadmap?.entries ?? []).map((e) => [`${e.itemType}:${e.itemId}`, e]),
  )
  const scoped = Boolean(plan.roadmap)
  const tagName = new Map(plan.tags.map((t) => [t.id, t.name]))
  const title = new Map<string, string>()
  const deps = plan.dependencies

  const initiativeIds = new Set(
    live(plan.initiatives)
      .filter((i) => !scoped || onRoadmap.has(`initiative:${i.id}`))
      .map((i) => i.id),
  )
  // The features of an initiative on the roadmap come with it, so the file shows the whole branch.
  const features = live(plan.features).filter(
    (f) =>
      !scoped ||
      onRoadmap.has(`feature:${f.id}`) ||
      (f.initiativeId !== undefined && initiativeIds.has(f.initiativeId)),
  )
  // A feature on the roadmap brings its initiative along, so the hierarchy is never cut.
  for (const f of features) if (f.initiativeId) initiativeIds.add(f.initiativeId)
  const initiatives = live(plan.initiatives).filter((i) => initiativeIds.has(i.id))
  const objectiveIds = new Set(initiatives.flatMap((i) => (i.objectiveId ? [i.objectiveId] : [])))
  const objectives = live(plan.objectives).filter((o) => !scoped || objectiveIds.has(o.id))
  for (const x of [...objectives, ...initiatives, ...features]) title.set(x.id, x.title)

  const level = (l?: string) => (l ? l[0]!.toUpperCase() + l.slice(1) : '')
  const links = (type: 'initiative' | 'feature', id: string, dir: 'out' | 'in') =>
    deps
      .filter((d) =>
        dir === 'out'
          ? d.kind === 'blocks' && d.fromType === type && d.fromId === id
          : d.kind === 'blocks' && d.toType === type && d.toId === id,
      )
      .map((d) => (dir === 'out' ? d.toId : d.fromId))
      .join(';')

  const rows: string[][] = []
  const sortByOrder = <T extends { order: number }>(xs: T[]) =>
    [...xs].sort((a, b) => a.order - b.order)
  for (const o of sortByOrder(objectives))
    rows.push([
      o.id,
      '',
      'objective',
      o.title,
      o.status,
      '',
      '',
      '',
      '',
      '',
      o.targetDate ?? '',
      '',
      '',
      '',
      '',
      '',
      '',
      o.description ?? '',
    ])
  const item = (
    type: 'initiative' | 'feature',
    x: Initiative | Feature,
    parent: string | undefined,
  ) => {
    const entry = onRoadmap.get(`${type}:${x.id}`)
    rows.push([
      x.id,
      parent ?? '',
      type,
      x.title,
      STATUS_LABELS[x.status],
      level(x.priority),
      level(x.scoring?.impact),
      level(x.scoring?.effort),
      level(x.confidence),
      x.startDate ?? '',
      x.endDate ?? '',
      entry?.lane ?? '',
      yes(Boolean(entry)),
      x.owner ?? '',
      x.tagIds
        .map((t) => tagName.get(t) ?? '')
        .filter(Boolean)
        .join(';'),
      links(type, x.id, 'out'),
      links(type, x.id, 'in'),
      x.description ?? '',
    ])
  }
  for (const i of sortByOrder(initiatives)) {
    item('initiative', i, i.objectiveId)
    for (const f of sortByOrder(features.filter((f) => f.initiativeId === i.id)))
      item('feature', f, i.id)
  }
  for (const f of sortByOrder(features.filter((f) => !f.initiativeId)))
    item('feature', f, undefined)
  return rows
}

export const planToCsv = (plan: PlanForCsv) => toCsv(CSV_COLUMNS, planToRows(plan))
