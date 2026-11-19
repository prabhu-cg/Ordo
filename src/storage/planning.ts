import {
  TAG_TONES,
  newId,
  nowIso,
  type Dependency,
  type Feature,
  type Initiative,
  type Milestone,
  type Objective,
  type Roadmap,
  type RoadmapView,
  type Tag,
} from '@/domain'
import { DATA_TABLES, type OrdoDB } from './db'
import { StorageError, guard } from './errors'
import type { NewRecord, RecordPatch } from './repository'
import type { Repositories } from './repositories'

/**
 * Planning operations: everything that creates, changes or removes objectives, initiatives and features.
 *
 * This is where the hierarchy is kept valid. Every operation runs in one transaction, so it either
 * fully happens or not at all:
 *  - a parent must exist, be live and belong to the same product before a child can point at it;
 *  - deleting a parent never leaves children pointing at it: the caller chooses to unlink or cascade;
 *  - roadmap entries and dependencies that mention a deleted item are removed with it;
 *  - the product's `updatedAt` moves whenever anything inside it changes.
 */
export interface PlanningData {
  objectives: Objective[]
  initiatives: Initiative[]
  features: Feature[]
  tags: Tag[]
  roadmaps: Roadmap[]
  milestones: Milestone[]
  views: RoadmapView[]
  dependencies: Dependency[]
}

export type DeleteStrategy = 'unlink' | 'cascade'

type Owned = 'productId' | 'order'
export type ObjectiveFields = Omit<NewRecord<Objective>, Owned>
export type InitiativeFields = Omit<NewRecord<Initiative>, Owned> & { newTags?: string[] }
export type FeatureFields = Omit<NewRecord<Feature>, Owned> & { newTags?: string[] }
export type MilestoneFields = Omit<NewRecord<Milestone>, 'productId'>
export type DependencyFields = Omit<NewRecord<Dependency>, 'productId'>

const fieldError = (field: string, message: string) =>
  new StorageError('VALIDATION', message, { fieldErrors: { [field]: message } })

/**
 * Saving means "these are the editable fields": any optional field left out is cleared, so a form's
 * empty input really empties the record instead of keeping the old value.
 */
function replacing<T extends object>(keys: readonly (keyof T)[], fields: Partial<T>): Partial<T> {
  return Object.fromEntries(keys.map((k) => [k, fields[k]])) as Partial<T>
}
const OBJECTIVE_KEYS = ['title', 'description', 'status', 'targetDate', 'outcomes'] as const
const ITEM_KEYS = [
  'title',
  'description',
  'status',
  'scoring',
  'priority',
  'confidence',
  'matrixOverride',
  'owner',
  'tagIds',
  'startDate',
  'endDate',
] as const

const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt)
const nextOrder = (rows: { order: number }[]) =>
  rows.reduce((max, r) => Math.max(max, r.order), 0) + 1

/** A stable tone for a new tag, so the same name always looks the same. */
function toneFor(name: string): Tag['tone'] {
  const options = TAG_TONES.filter((t) => t !== 'destructive')
  let hash = 0
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return options[hash % options.length]!
}

export function createPlanning(db: OrdoDB, r: Repositories) {
  const atomic = <T>(work: () => Promise<T>) =>
    guard(() =>
      db.transaction(
        'rw',
        DATA_TABLES.map((t) => db[t]),
        work,
      ),
    )

  async function requireProduct(productId: string) {
    const product = await r.products.get(productId)
    if (!product) throw new StorageError('NOT_FOUND', 'That product no longer exists.')
  }

  /** Move the product's "last modified" forward. Not a revision: the child change already has one. */
  const touch = (productId: string) => db.products.update(productId, { updatedAt: nowIso() })

  async function ownedBy<T extends { productId: string }>(
    row: T | undefined,
    productId: string,
    what: string,
  ): Promise<T> {
    if (!row || row.productId !== productId)
      throw new StorageError('NOT_FOUND', `That ${what} no longer exists.`)
    return row
  }

  async function resolveTags(productId: string, tagIds: string[], newTags: string[] = []) {
    const existing = live(await r.tags.findBy('productId', productId))
    const known = new Set(existing.map((t) => t.id))
    if (tagIds.some((id) => !known.has(id)))
      throw fieldError('tagIds', 'One of the tags no longer exists.')
    const ids = new Set(tagIds)
    for (const raw of newTags) {
      const name = raw.trim()
      if (!name) continue
      const match = existing.find((t) => t.name.toLowerCase() === name.toLowerCase())
      if (match) ids.add(match.id)
      else {
        const created = await r.tags.create({ productId, name, tone: toneFor(name) })
        existing.push(created)
        ids.add(created.id)
      }
    }
    return [...ids]
  }

  /** Remove roadmap entries and dependencies that mention these items, so nothing dangles. */
  async function removeReferences(
    productId: string,
    itemType: 'initiative' | 'feature',
    ids: string[],
  ) {
    if (ids.length === 0) return
    const gone = new Set(ids)
    for (const roadmap of live(await r.roadmaps.findBy('productId', productId))) {
      const entries = roadmap.entries.filter(
        (e) => !(e.itemType === itemType && gone.has(e.itemId)),
      )
      if (entries.length !== roadmap.entries.length)
        await r.roadmaps.update(roadmap.id, { entries })
    }
    for (const d of await r.dependencies.findBy('productId', productId)) {
      const touches =
        (d.fromType === itemType && gone.has(d.fromId)) ||
        (d.toType === itemType && gone.has(d.toId))
      if (touches) await r.dependencies.remove(d.id)
    }
  }

  async function deleteFeatureInTx(productId: string, id: string) {
    await removeReferences(productId, 'feature', [id])
    await r.features.remove(id)
  }

  async function deleteInitiativeInTx(productId: string, id: string, strategy: DeleteStrategy) {
    for (const feature of live(await r.features.findBy('initiativeId', id))) {
      if (strategy === 'cascade') await deleteFeatureInTx(productId, feature.id)
      else await r.features.update(feature.id, { initiativeId: undefined })
    }
    // Milestones can exist on their own, so they are kept and simply unlinked.
    for (const m of live(await r.milestones.findBy('initiativeId', id))) {
      await r.milestones.update(m.id, { initiativeId: undefined })
    }
    await removeReferences(productId, 'initiative', [id])
    await r.initiatives.remove(id)
  }

  return {
    load: (productId: string): Promise<PlanningData> =>
      guard(async () => {
        const [objectives, initiatives, features, tags, roadmaps, milestones, views, dependencies] =
          await Promise.all([
            r.objectives.findBy('productId', productId),
            r.initiatives.findBy('productId', productId),
            r.features.findBy('productId', productId),
            r.tags.findBy('productId', productId),
            r.roadmaps.findBy('productId', productId),
            r.milestones.findBy('productId', productId),
            r.roadmapViews.findBy('productId', productId),
            r.dependencies.findBy('productId', productId),
          ])
        return {
          objectives,
          initiatives,
          features,
          tags,
          roadmaps,
          milestones,
          views,
          dependencies,
        }
      }),

    saveObjective: (productId: string, fields: ObjectiveFields, id?: string) =>
      atomic(async () => {
        await requireProduct(productId)
        const outcomes = fields.outcomes?.map((o) => ({ ...o, id: o.id || newId() }))
        let saved: Objective
        if (id) {
          await ownedBy(await r.objectives.get(id), productId, 'objective')
          saved = await r.objectives.update(
            id,
            replacing<Objective>(OBJECTIVE_KEYS, { ...fields, outcomes }),
          )
        } else {
          const order = nextOrder(
            await r.objectives.findBy('productId', productId, { includeDeleted: true }),
          )
          saved = await r.objectives.create({ ...fields, outcomes, productId, order })
        }
        await touch(productId)
        return saved
      }),

    saveInitiative: (productId: string, fields: InitiativeFields, id?: string) =>
      atomic(async () => {
        await requireProduct(productId)
        const { newTags, ...rest } = fields
        if (rest.objectiveId) {
          const objective = await r.objectives.get(rest.objectiveId)
          if (!objective || objective.productId !== productId)
            throw fieldError('objectiveId', 'That objective no longer exists.')
        }
        const tagIds = await resolveTags(productId, rest.tagIds, newTags)
        let saved: Initiative
        if (id) {
          await ownedBy(await r.initiatives.get(id), productId, 'initiative')
          saved = await r.initiatives.update(
            id,
            replacing<Initiative>([...ITEM_KEYS, 'objectiveId'], { ...rest, tagIds }),
          )
        } else {
          const order = nextOrder(
            await r.initiatives.findBy('productId', productId, { includeDeleted: true }),
          )
          saved = await r.initiatives.create({ ...rest, tagIds, productId, order })
        }
        await touch(productId)
        return saved
      }),

    saveFeature: (productId: string, fields: FeatureFields, id?: string) =>
      atomic(async () => {
        await requireProduct(productId)
        const { newTags, ...rest } = fields
        if (rest.initiativeId) {
          const initiative = await r.initiatives.get(rest.initiativeId)
          if (!initiative || initiative.productId !== productId)
            throw fieldError('initiativeId', 'That initiative no longer exists.')
        }
        const tagIds = await resolveTags(productId, rest.tagIds, newTags)
        let saved: Feature
        if (id) {
          await ownedBy(await r.features.get(id), productId, 'feature')
          saved = await r.features.update(
            id,
            replacing<Feature>([...ITEM_KEYS, 'initiativeId'], { ...rest, tagIds }),
          )
        } else {
          const order = nextOrder(
            await r.features.findBy('productId', productId, { includeDeleted: true }),
          )
          saved = await r.features.create({ ...rest, tagIds, productId, order })
        }
        await touch(productId)
        return saved
      }),

    /** `unlink` keeps the initiatives (and everything under them) with no objective; `cascade` deletes them too. */
    deleteObjective: (productId: string, id: string, strategy: DeleteStrategy) =>
      atomic(async () => {
        await ownedBy(await r.objectives.get(id), productId, 'objective')
        for (const initiative of live(await r.initiatives.findBy('objectiveId', id))) {
          if (strategy === 'cascade')
            await deleteInitiativeInTx(productId, initiative.id, 'cascade')
          else await r.initiatives.update(initiative.id, { objectiveId: undefined })
        }
        await r.objectives.remove(id)
        await touch(productId)
      }),

    /** `unlink` keeps the features with no initiative; `cascade` deletes them too. */
    deleteInitiative: (productId: string, id: string, strategy: DeleteStrategy) =>
      atomic(async () => {
        await ownedBy(await r.initiatives.get(id), productId, 'initiative')
        await deleteInitiativeInTx(productId, id, strategy)
        await touch(productId)
      }),

    deleteFeature: (productId: string, id: string) =>
      atomic(async () => {
        await ownedBy(await r.features.get(id), productId, 'feature')
        await deleteFeatureInTx(productId, id)
        await touch(productId)
      }),

    /**
     * Change some fields of an initiative without resending the rest (a quick edit, a drag, a nudge).
     * Only the keys present in `patch` change; a key set to undefined clears that field.
     */
    patchInitiative: (productId: string, id: string, patch: RecordPatch<Initiative>) =>
      atomic(async () => {
        await ownedBy(await r.initiatives.get(id), productId, 'initiative')
        if (patch.objectiveId) {
          const o = await r.objectives.get(patch.objectiveId)
          if (!o || o.productId !== productId)
            throw fieldError('objectiveId', 'That objective no longer exists.')
        }
        const saved = await r.initiatives.update(id, patch)
        await touch(productId)
        return saved
      }),

    patchFeature: (productId: string, id: string, patch: RecordPatch<Feature>) =>
      atomic(async () => {
        await ownedBy(await r.features.get(id), productId, 'feature')
        if (patch.initiativeId) {
          const i = await r.initiatives.get(patch.initiativeId)
          if (!i || i.productId !== productId)
            throw fieldError('initiativeId', 'That initiative no longer exists.')
        }
        const saved = await r.features.update(id, patch)
        await touch(productId)
        return saved
      }),

    saveMilestone: (productId: string, fields: MilestoneFields, id?: string) =>
      atomic(async () => {
        await requireProduct(productId)
        if (fields.initiativeId) {
          const i = await r.initiatives.get(fields.initiativeId)
          if (!i || i.productId !== productId)
            throw fieldError('initiativeId', 'That initiative no longer exists.')
        }
        let saved: Milestone
        if (id) {
          await ownedBy(await r.milestones.get(id), productId, 'milestone')
          saved = await r.milestones.update(
            id,
            replacing<Milestone>(
              ['title', 'description', 'date', 'status', 'initiativeId'],
              fields,
            ),
          )
        } else saved = await r.milestones.create({ ...fields, productId })
        await touch(productId)
        return saved
      }),

    deleteMilestone: (productId: string, id: string) =>
      atomic(async () => {
        await ownedBy(await r.milestones.get(id), productId, 'milestone')
        await r.milestones.remove(id)
        await touch(productId)
      }),

    /**
     * "from blocks to": `to` cannot start until `from` is done. Both ends must exist in this product, the same
     * link cannot be added twice, and a "blocks" link may not close a loop (A blocks B blocks A).
     */
    saveDependency: (productId: string, fields: DependencyFields) =>
      atomic(async () => {
        await requireProduct(productId)
        const lookup = (type: 'initiative' | 'feature', id: string) =>
          type === 'initiative' ? r.initiatives.get(id) : r.features.get(id)
        const [from, to] = await Promise.all([
          lookup(fields.fromType, fields.fromId),
          lookup(fields.toType, fields.toId),
        ])
        if (!from || from.productId !== productId)
          throw fieldError('fromId', 'That item no longer exists.')
        if (!to || to.productId !== productId)
          throw fieldError('toId', 'That item no longer exists.')

        const existing = await r.dependencies.findBy('productId', productId)
        const same = (a: Dependency, b: DependencyFields) =>
          a.fromType === b.fromType &&
          a.fromId === b.fromId &&
          a.toType === b.toType &&
          a.toId === b.toId
        const reversed = {
          ...fields,
          fromType: fields.toType,
          fromId: fields.toId,
          toType: fields.fromType,
          toId: fields.fromId,
        }
        if (
          existing.some(
            (d) =>
              d.kind === fields.kind &&
              (same(d, fields) || (fields.kind === 'relates' && same(d, reversed))),
          )
        ) {
          throw fieldError('toId', 'That link already exists.')
        }
        if (fields.kind === 'blocks') {
          // Walk what `to` already blocks; reaching `from` would make a loop.
          const key = (t: string, id: string) => `${t}:${id}`
          const goal = key(fields.fromType, fields.fromId)
          const seen = new Set<string>()
          const queue = [key(fields.toType, fields.toId)]
          while (queue.length) {
            const here = queue.pop()!
            if (here === goal)
              throw fieldError(
                'toId',
                'That would make a loop: the other item already depends on this one.',
              )
            if (seen.has(here)) continue
            seen.add(here)
            for (const d of existing)
              if (d.kind === 'blocks' && key(d.fromType, d.fromId) === here)
                queue.push(key(d.toType, d.toId))
          }
        }
        const saved = await r.dependencies.create({ ...fields, productId })
        await touch(productId)
        return saved
      }),

    deleteDependency: (productId: string, id: string) =>
      atomic(async () => {
        await ownedBy(await r.dependencies.get(id), productId, 'link')
        await r.dependencies.remove(id)
        await touch(productId)
      }),

    /** Delete a tag and take it off every item that used it. */
    deleteTag: (productId: string, id: string) =>
      atomic(async () => {
        await ownedBy(await r.tags.get(id), productId, 'tag')
        for (const i of live(await r.initiatives.findBy('tagIds', id)))
          await r.initiatives.update(i.id, { tagIds: i.tagIds.filter((t) => t !== id) })
        for (const f of live(await r.features.findBy('tagIds', id)))
          await r.features.update(f.id, { tagIds: f.tagIds.filter((t) => t !== id) })
        await r.tags.remove(id)
        await touch(productId)
      }),
  }
}

export type Planning = ReturnType<typeof createPlanning>
