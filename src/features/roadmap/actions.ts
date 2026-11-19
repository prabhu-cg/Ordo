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
import { useUndoStore, type UndoOp } from '@/store/undo-store'
import { planMove, type Drop, type ItemType, type RoadmapRow } from './engine'
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

/** Carry out saved undo steps. They are data, so this also works for history that survived a reload. */
async function runOps(ops: UndoOp[]) {
  const storage = getStorage()
  for (const op of ops) {
    switch (op.t) {
      case 'patch':
        await writeItem(op.kind, op.id, op.before as ItemPatch)
        break
      case 'entries':
        await writeEntries(op.roadmapId, op.entries as RoadmapEntry[])
        break
      case 'dep-delete':
        await storage.planning.deleteDependency(productId(), op.id)
        break
      case 'dep-create':
        await storage.planning.saveDependency(productId(), op.fields)
        break
      case 'roadmap-restore':
        await storage.roadmapService.restore(productId(), op.id)
        break
      case 'milestone-restore':
        await storage.milestones.restore(op.id)
        break
    }
  }
  await planningState().commit()
}

/** Record an undo and tell the user, with the button right there. */
function recordUndo(label: string, ops: UndoOp[], announce = true) {
  const entry = useUndoStore.getState().push(label, ops)
  if (announce) {
    toast.success(label, undefined, {
      label: 'Undo',
      onClick: () =>
        void attempt(() => useUndoStore.getState().undoEntry(entry.id, runOps)).then(
          (ok) =>
            ok === false &&
            toast.info('Too late to undo that', 'Something else has changed since.'),
        ),
    })
  }
}

/** Undo the latest change (the toolbar button and Ctrl or Cmd Z). */
export async function undoLatest() {
  const label = await attempt(() => useUndoStore.getState().undoLast(runOps))
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

const snapshot = (item: object, keys: string[]): ItemPatch =>
  Object.fromEntries(keys.map((k) => [k, (item as Record<string, unknown>)[k]])) as ItemPatch

/** Change fields of an initiative or feature wherever it is shown (a card, a bar, the matrix). Undoable. */
export async function updateWork(
  kind: ItemType,
  item: object & { id: string },
  patch: ItemPatch,
  label: string,
  options: { announce?: boolean } = {},
) {
  const before = snapshot(item, Object.keys(patch))
  return attempt(async () => {
    await writeItem(kind, item.id, patch)
    await planningState().commit()
    recordUndo(label, [{ t: 'patch', kind, id: item.id, before }], options.announce ?? true)
    return true
  })
}

/** Change fields of the item behind a roadmap row (quick edit, board drop, date drag). Undoable. */
export const updateItem = (
  row: RoadmapRow,
  patch: ItemPatch,
  label: string,
  options: { announce?: boolean } = {},
) => updateWork(row.kind, row.item, patch, label, options)

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
  const plan = planMove({
    entries: entriesBefore,
    row: o.row,
    drop: o.drop,
    lane: o.lane,
    itemPatch: o.itemPatch,
    reorder: o.reorder,
    mode: o.mode,
    today: today(),
  })
  if (plan.unchanged) return true
  const patch = plan.itemPatch as ItemPatch
  const before = snapshot(o.row.item, Object.keys(patch))

  return attempt(async () => {
    if (Object.keys(patch).length > 0) await writeItem(o.row.kind, o.row.item.id, patch)
    try {
      await writeEntries(o.roadmapId, plan.entries)
    } catch (e) {
      if (Object.keys(patch).length > 0) await writeItem(o.row.kind, o.row.item.id, before) // do not leave half a move behind
      throw e
    }
    await planningState().commit()
    recordUndo(o.label, [
      { t: 'entries', roadmapId: o.roadmapId, entries: entriesBefore },
      ...(Object.keys(patch).length > 0
        ? [{ t: 'patch' as const, kind: o.row.kind, id: o.row.item.id, before }]
        : []),
    ])
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
    recordUndo(`Added ${n} ${n === 1 ? 'item' : 'items'}`, [
      { t: 'entries', roadmapId, entries: before },
    ])
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
    recordUndo(`Removed “${row.item.title}” from the roadmap`, [
      { t: 'entries', roadmapId, entries: before },
    ])
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
    recordUndo(`Deleted roadmap “${name}”`, [{ t: 'roadmap-restore', id }])
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
    if (m) recordUndo(`Deleted milestone “${m.title}”`, [{ t: 'milestone-restore', id }])
    return true
  })
}

export async function addDependency(fields: DependencyFields) {
  return attempt(async () => {
    const saved = await getStorage().planning.saveDependency(productId(), fields)
    await planningState().commit()
    recordUndo('Added a link', [{ t: 'dep-delete', id: saved.id }], false)
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
    recordUndo('Removed a link', [{ t: 'dep-create', fields: rest }])
    return true
  })
}

export const ensureViews = (roadmapId: string) =>
  attempt(async () => {
    await getStorage().roadmapService.ensureViews(productId(), roadmapId)
    await planningState().commit()
    return true
  })
