import {
  nowIso,
  type Roadmap,
  type RoadmapEntry,
  type RoadmapView,
  type WorkStatus,
  type Lane,
} from '@/domain'
import { DATA_TABLES, type OrdoDB } from './db'
import { StorageError, guard } from './errors'
import type { NewRecord } from './repository'
import type { Repositories } from './repositories'

/**
 * Roadmap operations. A roadmap is a list of entries that point at initiatives and features; the three
 * views are only different ways of drawing that one list, so there is exactly one place to change
 * placement. Every operation runs in one transaction, and an entry may never point at something that is
 * missing, archived, in another product, or already on the roadmap.
 */
export type RoadmapFields = Pick<
  NewRecord<Roadmap>,
  | 'name'
  | 'description'
  | 'planningHorizon'
  | 'defaultView'
  | 'planningMode'
  | 'itemTypes'
  | 'color'
>
export type NewEntry = { itemType: 'initiative' | 'feature'; itemId: string; lane?: Lane }

const fieldError = (field: string, message: string) =>
  new StorageError('VALIDATION', message, { fieldErrors: { [field]: message } })
const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt)

/** A sensible starting lane from how far along an initiative is. */
const START_LANE: Record<WorkStatus, Lane | undefined> = {
  'in-progress': 'now',
  shipped: 'now',
  planned: 'next',
  idea: 'later',
  paused: 'later',
  dropped: undefined,
}

const VIEW_DEFAULTS = [
  { layout: 'now-next-later' as const, name: 'Now, next, later' },
  { layout: 'timeline' as const, name: 'Timeline' },
  { layout: 'board' as const, name: 'Board' },
]

export function createRoadmapService(db: OrdoDB, r: Repositories) {
  const atomic = <T>(work: () => Promise<T>) =>
    guard(() =>
      db.transaction(
        'rw',
        DATA_TABLES.map((t) => db[t]),
        work,
      ),
    )
  const touch = (productId: string) => db.products.update(productId, { updatedAt: nowIso() })

  async function requireRoadmap(productId: string, id: string): Promise<Roadmap> {
    const roadmap = await r.roadmaps.get(id)
    if (!roadmap || roadmap.productId !== productId)
      throw new StorageError('NOT_FOUND', 'That roadmap no longer exists.')
    return roadmap
  }

  /** Every entry must point at a live item of the right kind in this product, once. */
  async function checkEntries(productId: string, entries: RoadmapEntry[]) {
    const seen = new Set<string>()
    for (const e of entries) {
      const key = `${e.itemType}:${e.itemId}`
      if (seen.has(key)) throw fieldError('entries', 'An item can only be on a roadmap once.')
      seen.add(key)
      const item =
        e.itemType === 'initiative'
          ? await r.initiatives.get(e.itemId)
          : await r.features.get(e.itemId)
      if (!item || item.productId !== productId)
        throw fieldError('entries', 'One of the items no longer exists.')
    }
  }

  async function ensureViews(productId: string, roadmapId: string) {
    const existing = await r.roadmapViews.findBy('roadmapId', roadmapId)
    for (const [index, v] of VIEW_DEFAULTS.entries()) {
      if (!existing.some((e) => e.layout === v.layout)) {
        await r.roadmapViews.create({
          productId,
          roadmapId,
          name: v.name,
          layout: v.layout,
          config: {},
          order: index + 1,
        })
      }
    }
  }

  return {
    create: (
      productId: string,
      fields: RoadmapFields,
      options: { includeInitiatives?: boolean } = {},
    ) =>
      atomic(async () => {
        const product = await r.products.get(productId)
        if (!product) throw new StorageError('NOT_FOUND', 'That product no longer exists.')
        let entries: RoadmapEntry[] = []
        if (options.includeInitiatives) {
          const initiatives = live(await r.initiatives.findBy('productId', productId)).sort(
            (a, b) => a.order - b.order,
          )
          entries = initiatives.flatMap((i) =>
            START_LANE[i.status]
              ? [
                  {
                    itemType: 'initiative' as const,
                    itemId: i.id,
                    lane: START_LANE[i.status],
                    order: 0,
                  },
                ]
              : [],
          )
          entries = entries.map((e, index) => ({ ...e, order: index + 1 }))
        }
        const roadmap = await r.roadmaps.create({ ...fields, productId, entries })
        await ensureViews(productId, roadmap.id)
        await touch(productId)
        return roadmap
      }),

    update: (productId: string, id: string, fields: RoadmapFields) =>
      atomic(async () => {
        await requireRoadmap(productId, id)
        const keys = [
          'name',
          'description',
          'planningHorizon',
          'defaultView',
          'planningMode',
          'itemTypes',
          'color',
        ] as const
        const patch = Object.fromEntries(keys.map((k) => [k, fields[k]])) as Partial<Roadmap>
        const saved = await r.roadmaps.update(id, patch)
        await touch(productId)
        return saved
      }),

    /** Archive a roadmap. The initiatives and features on it are untouched. */
    delete: (productId: string, id: string) =>
      atomic(async () => {
        await requireRoadmap(productId, id)
        await r.roadmaps.remove(id)
        await touch(productId)
      }),

    restore: (productId: string, id: string) =>
      atomic(async () => {
        const roadmap = await r.roadmaps.get(id, { includeDeleted: true })
        if (!roadmap || roadmap.productId !== productId)
          throw new StorageError('NOT_FOUND', 'That roadmap no longer exists.')
        const saved = await r.roadmaps.restore(id)
        await touch(productId)
        return saved
      }),

    /** Put items on the roadmap. Items already there are left exactly where they are. */
    addItems: (productId: string, roadmapId: string, items: NewEntry[]) =>
      atomic(async () => {
        const roadmap = await requireRoadmap(productId, roadmapId)
        const allowed = roadmap.itemTypes ?? ['initiative', 'feature', 'milestone']
        const present = new Set(roadmap.entries.map((e) => `${e.itemType}:${e.itemId}`))
        const fresh = items.filter(
          (i, index) =>
            !present.has(`${i.itemType}:${i.itemId}`) &&
            items.findIndex((x) => x.itemType === i.itemType && x.itemId === i.itemId) === index,
        )
        if (fresh.some((i) => !allowed.includes(i.itemType)))
          throw fieldError(
            'entries',
            `This roadmap does not show ${fresh.find((i) => !allowed.includes(i.itemType))!.itemType}s.`,
          )
        let order = roadmap.entries.reduce((max, e) => Math.max(max, e.order), 0)
        const entries = [
          ...roadmap.entries,
          ...fresh.map((i) => ({
            itemType: i.itemType,
            itemId: i.itemId,
            lane: i.lane,
            order: ++order,
          })),
        ]
        await checkEntries(productId, entries)
        const saved = await r.roadmaps.update(roadmapId, { entries })
        await touch(productId)
        return saved
      }),

    removeItems: (
      productId: string,
      roadmapId: string,
      items: { itemType: 'initiative' | 'feature'; itemId: string }[],
    ) =>
      atomic(async () => {
        const roadmap = await requireRoadmap(productId, roadmapId)
        const gone = new Set(items.map((i) => `${i.itemType}:${i.itemId}`))
        const entries = roadmap.entries.filter((e) => !gone.has(`${e.itemType}:${e.itemId}`))
        const saved = await r.roadmaps.update(roadmapId, { entries })
        await touch(productId)
        return saved
      }),

    /** Replace the placement list: how every drag, reorder and undo is stored. Validated like any other write. */
    setEntries: (productId: string, roadmapId: string, entries: RoadmapEntry[]) =>
      atomic(async () => {
        await requireRoadmap(productId, roadmapId)
        await checkEntries(productId, entries)
        const saved = await r.roadmaps.update(roadmapId, { entries })
        await touch(productId)
        return saved
      }),

    /** Remember a view's own settings (board grouping, timeline zoom, card fields). */
    saveView: (productId: string, viewId: string, config: RoadmapView['config']) =>
      atomic(async () => {
        const view = await r.roadmapViews.get(viewId)
        if (!view || view.productId !== productId)
          throw new StorageError('NOT_FOUND', 'That view no longer exists.')
        return r.roadmapViews.update(viewId, { config })
      }),

    ensureViews: (productId: string, roadmapId: string) =>
      atomic(async () => {
        await requireRoadmap(productId, roadmapId)
        await ensureViews(productId, roadmapId)
      }),
  }
}

export type RoadmapService = ReturnType<typeof createRoadmapService>
