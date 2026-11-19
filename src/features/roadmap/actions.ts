import { toast } from '@/components/ui/toast'
import type {
  Dependency,
  Feature,
  Initiative,
  Lane,
  PlanningMode,
  Roadmap,
  RoadmapEntry,
} from '@/domain'
import {
  getStorage,
  toStorageError,
  type DependencyFields,
  type MilestoneFields,
  type NewEntry,
  type RoadmapFields,
} from '@/storage'
import { usePlanningStore } from '@/store/planning-store'
import { useUndoStore } from '@/store/undo-store'
import {
  datesForLane,
  isDated,
  placeEntry,
  rowKey,
  type Drop,
  type ItemType,
  type RoadmapRow,
} from './engine'
import { today } from './dates'

/**
 * Every change a roadmap view can make goes through here. Each one writes through the storage layer (which
 * validates it and does it in one transaction), refreshes the shared planning data so every view redraws, and
 * records how to put things back. Views never hold their own copy of anything.
 */
const planningState = () => usePlanningStore.getState()
const productId = () => {
  const id = planningState().productId
  if (!id) throw new Error('No product is open.')
  return id
}
const roadmapOf = (id: string): Roadmap => {
  const r = planningState().roadmaps.find((x) => x.id === id)
  if (!r) throw new Error('That roadmap no longer exists.')
  return r
}

/** Run a change; show a clear message if it fails instead of throwing into the page. */
export async function attempt<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work()
  } catch (e) {
    toast.error('That did not work', toStorageError(e).message)
    return undefined
  }
}

/** Record an undo and tell the user, with the button right there. */
function recordUndo(label: string, undo: () => Promise<void>, announce = true) {
  const entry = useUndoStore.getState().push(label, async () => {
    await undo()
    await planningState().commit()
  })
  if (announce) {
    toast.success(label, undefined, {
      label: 'Undo',
      onClick: () =>
        void attempt(() => useUndoStore.getState().undoEntry(entry.id)).then(
          (ok) =>
            ok === false &&
            toast.info('Too late to undo that', 'Something else has changed since.'),
        ),
    })
  }
}

/** Undo the latest change (the toolbar button and Ctrl or Cmd Z). */
export async function undoLatest() {
  const label = await attempt(() => useUndoStore.getState().undoLast())
  if (label) toast.info('Undone', label)
  else if (label === undefined && useUndoStore.getState().stack.length === 0)
    toast.info('Nothing to undo')
}

// ── Items ───────────────────────────────────────────────────────────────────

type ItemPatch = Partial<Initiative & Feature>

async function writeItem(kind: ItemType, id: string, patch: ItemPatch) {
  const planning = getStorage().planning
  if (kind === 'initiative')
    await planning.patchInitiative(productId(), id, patch as Partial<Initiative>)
  else await planning.patchFeature(productId(), id, patch as Partial<Feature>)
}

/** Only the fields that would really change: dropping a card back in its own column changes nothing. */
const pruneUnchanged = (item: object, patch: ItemPatch): ItemPatch =>
  Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => (item as Record<string, unknown>)[k] !== v),
  ) as ItemPatch

const snapshot = (item: object, keys: string[]): ItemPatch =>
  Object.fromEntries(keys.map((k) => [k, (item as Record<string, unknown>)[k]])) as ItemPatch

/** Change fields of an initiative or feature (quick edit, board drop, date drag). Undoable. */
export async function updateItem(
  row: RoadmapRow,
  patch: ItemPatch,
  label: string,
  options: { announce?: boolean } = {},
) {
  const before = snapshot(row.item, Object.keys(patch))
  return attempt(async () => {
    await writeItem(row.kind, row.item.id, patch)
    await planningState().commit()
    recordUndo(label, () => writeItem(row.kind, row.item.id, before), options.announce ?? true)
    return true
  })
}

// ── Placement ───────────────────────────────────────────────────────────────

async function writeEntries(roadmapId: string, entries: RoadmapEntry[]) {
  await getStorage().roadmapService.setEntries(productId(), roadmapId, entries)
}

export interface MoveOptions {
  roadmapId: string
  row: RoadmapRow
  drop?: Pick<Drop, 'anchorKey' | 'place'>
  /** The lane to put it in (now, next, later, or none). */
  lane?: Lane | null
  /** Also change the item (a board drop changes status, priority or initiative). */
  itemPatch?: ItemPatch
  /** Whether to renumber (false when the board is sorted by something other than your order). */
  reorder?: boolean
  mode?: PlanningMode
  label: string
}

/**
 * Move a card: its place in the roadmap's order, its lane, and, if the move implies one, a change to the item
 * itself. On a date-based roadmap, a lane change also moves the item's dates so the timeline follows. One undo
 * puts all of it back.
 */
export async function moveRow(o: MoveOptions) {
  const roadmap = roadmapOf(o.roadmapId)
  const entriesBefore = roadmap.entries
  const patch: ItemPatch = pruneUnchanged(o.row.item, o.itemPatch ?? {})
  const entryPatch: Partial<RoadmapEntry> = {}
  if (o.lane !== undefined) {
    entryPatch.lane = o.lane ?? undefined
    if (o.mode === 'dates' && o.lane && isDated(o.row.item)) {
      const range = datesForLane(o.lane, o.row.item, today())
      patch.startDate = range.start
      patch.endDate = range.end
    }
  }
  const entries =
    o.reorder === false
      ? entriesBefore.map((e) =>
          rowKey(e.itemType, e.itemId) === o.row.key ? { ...e, ...entryPatch } : e,
        )
      : placeEntry(
          entriesBefore,
          o.row.key,
          o.drop?.anchorKey,
          o.drop?.place ?? 'after',
          entryPatch,
        )
  const unchanged =
    JSON.stringify(entries) === JSON.stringify(entriesBefore) && Object.keys(patch).length === 0
  if (unchanged) return true
  const before = snapshot(o.row.item, Object.keys(patch))

  return attempt(async () => {
    if (Object.keys(patch).length > 0) await writeItem(o.row.kind, o.row.item.id, patch)
    try {
      await writeEntries(o.roadmapId, entries)
    } catch (e) {
      if (Object.keys(patch).length > 0) await writeItem(o.row.kind, o.row.item.id, before) // do not leave half a move behind
      throw e
    }
    await planningState().commit()
    recordUndo(o.label, async () => {
      await writeEntries(o.roadmapId, entriesBefore)
      if (Object.keys(patch).length > 0) await writeItem(o.row.kind, o.row.item.id, before)
    })
    return true
  })
}

// ── Roadmap membership ──────────────────────────────────────────────────────

export async function addItems(roadmapId: string, items: NewEntry[]) {
  const before = roadmapOf(roadmapId).entries
  return attempt(async () => {
    await getStorage().roadmapService.addItems(productId(), roadmapId, items)
    await planningState().commit()
    const n = items.length
    recordUndo(`Added ${n} ${n === 1 ? 'item' : 'items'}`, () => writeEntries(roadmapId, before))
    return true
  })
}

export async function removeRow(roadmapId: string, row: RoadmapRow) {
  const before = roadmapOf(roadmapId).entries
  return attempt(async () => {
    await getStorage().roadmapService.removeItems(productId(), roadmapId, [
      { itemType: row.kind, itemId: row.item.id },
    ])
    await planningState().commit()
    recordUndo(`Removed “${row.item.title}” from the roadmap`, () =>
      writeEntries(roadmapId, before),
    )
    return true
  })
}

// ── Roadmaps themselves ─────────────────────────────────────────────────────

/**
 * Create or edit a roadmap's settings. This throws so the form can show a problem next to the field it is about.
 */
export async function saveRoadmap(
  id: string | undefined,
  fields: RoadmapFields,
  includeInitiatives = false,
): Promise<Roadmap> {
  const service = getStorage().roadmapService
  const saved = id
    ? await service.update(productId(), id, fields)
    : await service.create(productId(), fields, { includeInitiatives })
  await planningState().commit()
  return saved
}

export async function deleteRoadmap(id: string) {
  const name = roadmapOf(id).name
  return attempt(async () => {
    await getStorage().roadmapService.delete(productId(), id)
    await planningState().commit()
    recordUndo(
      `Deleted roadmap “${name}”`,
      async () => void (await getStorage().roadmapService.restore(productId(), id)),
    )
    return true
  })
}

/** Remember a view's own settings. Not undoable: it is a preference, not an edit to your plan. */
export const saveViewConfig = (
  viewId: string,
  config: Parameters<ReturnType<typeof getStorage>['roadmapService']['saveView']>[2],
) =>
  attempt(async () => {
    await getStorage().roadmapService.saveView(productId(), viewId, config)
    await planningState().commit()
    return true
  })

// ── Milestones and links ────────────────────────────────────────────────────

/** Throws, so the milestone form can show a problem next to its field. */
export async function saveMilestone(fields: MilestoneFields, id?: string) {
  const saved = await getStorage().planning.saveMilestone(productId(), fields, id)
  await planningState().commit()
  return saved
}

export async function deleteMilestone(id: string) {
  const m = planningState().milestones.find((x) => x.id === id)
  return attempt(async () => {
    await getStorage().planning.deleteMilestone(productId(), id)
    await planningState().commit()
    if (m)
      recordUndo(
        `Deleted milestone “${m.title}”`,
        async () => void (await getStorage().milestones.restore(id)),
      )
    return true
  })
}

export async function addDependency(fields: DependencyFields) {
  return attempt(async () => {
    const saved = await getStorage().planning.saveDependency(productId(), fields)
    await planningState().commit()
    recordUndo(
      'Added a link',
      async () => getStorage().planning.deleteDependency(productId(), saved.id),
      false,
    )
    return saved
  })
}

export async function removeDependency(dep: Dependency) {
  return attempt(async () => {
    await getStorage().planning.deleteDependency(productId(), dep.id)
    await planningState().commit()
    const rest: DependencyFields = {
      fromType: dep.fromType,
      fromId: dep.fromId,
      toType: dep.toType,
      toId: dep.toId,
      kind: dep.kind,
      note: dep.note,
    }
    recordUndo(
      'Removed a link',
      async () => void (await getStorage().planning.saveDependency(productId(), rest)),
    )
    return true
  })
}

export const ensureViews = (roadmapId: string) =>
  attempt(async () => {
    await getStorage().roadmapService.ensureViews(productId(), roadmapId)
    await planningState().commit()
    return true
  })
