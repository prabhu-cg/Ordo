import { create } from 'zustand'

export type ItemKind = 'objective' | 'initiative' | 'feature'

/** What the item drawer is open on. `id` edits an existing item; otherwise a new one is created from `preset`. */
export interface DrawerTarget {
  kind: ItemKind
  id?: string
  preset?: { objectiveId?: string; initiativeId?: string }
}

interface DrawerState {
  target?: DrawerTarget
  /** An item the user asked to delete; the confirmation dialog reads this. */
  deleting?: { kind: ItemKind; id: string }
  open: (target: DrawerTarget) => void
  close: () => void
  askDelete: (kind: ItemKind, id: string) => void
  cancelDelete: () => void
}

/** One place that says which planning drawer or confirmation is showing, so any page can open one. */
export const useItemDrawer = create<DrawerState>((set) => ({
  open: (target) => set({ target }),
  close: () => set({ target: undefined }),
  askDelete: (kind, id) => set({ deleting: { kind, id } }),
  cancelDelete: () => set({ deleting: undefined }),
}))
