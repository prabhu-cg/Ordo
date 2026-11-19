import { create } from 'zustand'
import type { Lane } from '@/domain'

export type ItemKind = 'objective' | 'initiative' | 'feature'

/** What the item drawer is open on. `id` edits an existing item; otherwise a new one is created from `preset`. */
export interface DrawerTarget {
  kind: ItemKind
  id?: string
  preset?: { objectiveId?: string; initiativeId?: string }
}

/** The roadmap's own drawers. */
export interface RoadmapDrawers {
  /** The detail drawer for one card on a roadmap. */
  item?: { roadmapId: string; itemType: 'initiative' | 'feature'; itemId: string }
  /** Choose items to put on a roadmap. */
  add?: { roadmapId: string; lane?: Lane }
  /** Create (no id) or edit a roadmap's settings. */
  form?: { id?: string }
  milestone?: { id?: string; date?: string }
  /** Save a roadmap's structure as a template. */
  saveTemplate?: { roadmapId?: string }
  /** Rename or re-describe a custom template. */
  editTemplate?: { id: string }
}

interface DrawerState extends RoadmapDrawers {
  target?: DrawerTarget
  /** An item the user asked to delete; the confirmation dialog reads this. */
  deleting?: { kind: ItemKind; id: string }
  open: (target: DrawerTarget) => void
  close: () => void
  askDelete: (kind: ItemKind, id: string) => void
  cancelDelete: () => void

  openRoadmapItem: (roadmapId: string, itemType: 'initiative' | 'feature', itemId: string) => void
  closeRoadmapItem: () => void
  openAddItems: (roadmapId: string, lane?: Lane) => void
  closeAddItems: () => void
  openRoadmapForm: (id?: string) => void
  closeRoadmapForm: () => void
  openMilestone: (id?: string, date?: string) => void
  closeMilestone: () => void
  openSaveTemplate: (roadmapId?: string) => void
  closeSaveTemplate: () => void
  openEditTemplate: (id: string) => void
  closeEditTemplate: () => void
}

/** One place that says which drawer or confirmation is showing, so any page can open one. */
export const useItemDrawer = create<DrawerState>((set) => ({
  open: (target) => set({ target }),
  close: () => set({ target: undefined }),
  askDelete: (kind, id) => set({ deleting: { kind, id } }),
  cancelDelete: () => set({ deleting: undefined }),

  openRoadmapItem: (roadmapId, itemType, itemId) => set({ item: { roadmapId, itemType, itemId } }),
  closeRoadmapItem: () => set({ item: undefined }),
  openAddItems: (roadmapId, lane) => set({ add: { roadmapId, lane } }),
  closeAddItems: () => set({ add: undefined }),
  openRoadmapForm: (id) => set({ form: { id } }),
  closeRoadmapForm: () => set({ form: undefined }),
  openMilestone: (id, date) => set({ milestone: { id, date } }),
  closeMilestone: () => set({ milestone: undefined }),
  openSaveTemplate: (roadmapId) => set({ saveTemplate: { roadmapId } }),
  closeSaveTemplate: () => set({ saveTemplate: undefined }),
  openEditTemplate: (id) => set({ editTemplate: { id } }),
  closeEditTemplate: () => set({ editTemplate: undefined }),
}))
