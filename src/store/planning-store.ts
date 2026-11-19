import { create } from 'zustand'
import {
  toStorageError,
  getStorage,
  type DeleteStrategy,
  type FeatureFields,
  type InitiativeFields,
  type ObjectiveFields,
  type PlanningData,
  type StorageError,
} from '@/storage'
import type {
  Dependency,
  Feature,
  Initiative,
  Milestone,
  Objective,
  Roadmap,
  RoadmapView,
  Tag,
} from '@/domain'
import { useUndoStore } from './undo-store'
import { useWorkspaceStore } from './workspace-store'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface PlanningState {
  /** The product these records belong to. Records are only trusted when this matches the active product. */
  productId?: string
  status: Status
  error?: StorageError
  objectives: Objective[]
  initiatives: Initiative[]
  features: Feature[]
  tags: Tag[]
  roadmaps: Roadmap[]
  milestones: Milestone[]
  views: RoadmapView[]
  dependencies: Dependency[]

  load: (productId: string | undefined) => Promise<void>
  reload: () => Promise<void>
  /** Re-read this product's records and tell the rest of the app its "last modified" moved. Call after any write. */
  commit: () => Promise<void>

  saveObjective: (fields: ObjectiveFields, id?: string) => Promise<Objective>
  saveInitiative: (fields: InitiativeFields, id?: string) => Promise<Initiative>
  saveFeature: (fields: FeatureFields, id?: string) => Promise<Feature>
  deleteObjective: (id: string, strategy: DeleteStrategy) => Promise<void>
  deleteInitiative: (id: string, strategy: DeleteStrategy) => Promise<void>
  deleteFeature: (id: string) => Promise<void>
}

const EMPTY = {
  objectives: [],
  initiatives: [],
  features: [],
  tags: [],
  roadmaps: [],
  milestones: [],
  views: [],
  dependencies: [],
}
const byOrder = <T extends { order: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.order - b.order)
const liveRows = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt)

function shape(data: PlanningData) {
  return {
    objectives: byOrder(liveRows(data.objectives)),
    initiatives: byOrder(liveRows(data.initiatives)),
    features: byOrder(liveRows(data.features)),
    tags: liveRows(data.tags).sort((a, b) => a.name.localeCompare(b.name)),
    roadmaps: liveRows(data.roadmaps),
    milestones: liveRows(data.milestones),
    views: [...data.views].sort((a, b) => a.order - b.order),
    dependencies: data.dependencies,
  }
}

/**
 * Everything planned inside the active product, held centrally so a change made in a drawer shows up in
 * the overview, the lists, the sidebar counts and the dashboard at once. Every write goes through the
 * storage layer's planning operations (validated and transactional) and then re-reads.
 */
export const usePlanningStore = create<PlanningState>((set, get) => {
  /** The active product is the only one these operations may touch. */
  const requireProduct = () => {
    const id = get().productId
    if (!id) throw new Error('No product is open.')
    return id
  }

  async function afterWrite() {
    await get().reload()
    // The product's "last modified" moved; let the dashboard and switcher see it.
    await useWorkspaceStore.getState().refresh()
  }

  return {
    status: 'idle',
    ...EMPTY,

    async load(productId) {
      if (!productId) {
        useUndoStore.getState().clear()
        set({ productId: undefined, status: 'idle', error: undefined, ...EMPTY })
        return
      }
      // Switching product: drop the old product's records immediately so they are never shown against the new one.
      if (get().productId !== productId) {
        useUndoStore.getState().clear() // an undo belongs to the product it was made in
        set({ productId, status: 'loading', error: undefined, ...EMPTY })
      }
      try {
        const data = await getStorage().planning.load(productId)
        if (get().productId !== productId) return // the user switched again while this was loading
        set({ ...shape(data), status: 'ready', error: undefined })
      } catch (e) {
        if (get().productId === productId) set({ status: 'error', error: toStorageError(e) })
      }
    },

    async commit() {
      await afterWrite()
    },

    async reload() {
      const id = get().productId
      if (id) await get().load(id)
    },

    async saveObjective(fields, id) {
      const saved = await getStorage().planning.saveObjective(requireProduct(), fields, id)
      await afterWrite()
      return saved
    },
    async saveInitiative(fields, id) {
      const saved = await getStorage().planning.saveInitiative(requireProduct(), fields, id)
      await afterWrite()
      return saved
    },
    async saveFeature(fields, id) {
      const saved = await getStorage().planning.saveFeature(requireProduct(), fields, id)
      await afterWrite()
      return saved
    },
    async deleteObjective(id, strategy) {
      await getStorage().planning.deleteObjective(requireProduct(), id, strategy)
      await afterWrite()
    },
    async deleteInitiative(id, strategy) {
      await getStorage().planning.deleteInitiative(requireProduct(), id, strategy)
      await afterWrite()
    },
    async deleteFeature(id) {
      await getStorage().planning.deleteFeature(requireProduct(), id)
      await afterWrite()
    },
  }
})
