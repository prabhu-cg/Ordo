import { createContext, useContext } from 'react'
import type { Lane, RoadmapView } from '@/domain'
import { useItemDrawer } from '@/store/drawer-store'
import * as real from './actions'
import type { ItemType, RoadmapRow } from './engine'

/**
 * What the roadmap views do when you act on them. In the app these write to your data (and can be undone). In a
 * template preview they change a throwaway copy in memory, so the views themselves are the same code in both.
 */
export interface RoadmapBindings {
  moveRow: (o: real.MoveOptions) => Promise<unknown>
  updateItem: (
    row: RoadmapRow,
    patch: Partial<Record<string, unknown>>,
    label: string,
    options?: { announce?: boolean },
  ) => Promise<unknown>
  removeRow: (roadmapId: string, row: RoadmapRow) => Promise<unknown>
  saveViewConfig: (viewId: string, config: RoadmapView['config']) => Promise<unknown>
  openItem: (roadmapId: string, kind: ItemType, itemId: string) => void
  /** Absent in a preview, where nothing can be added to the roadmap. */
  openAdd?: (roadmapId: string, lane?: Lane) => void
  /** Absent in a preview, where milestones cannot be edited. */
  openMilestone?: (id?: string, date?: string) => void
}

export const realBindings: RoadmapBindings = {
  moveRow: real.moveRow,
  updateItem: (row, patch, label, options) => real.updateItem(row, patch, label, options),
  removeRow: real.removeRow,
  saveViewConfig: real.saveViewConfig,
  openItem: (roadmapId, kind, itemId) =>
    useItemDrawer.getState().openRoadmapItem(roadmapId, kind, itemId),
  openAdd: (roadmapId, lane) => useItemDrawer.getState().openAddItems(roadmapId, lane),
  openMilestone: (id, date) => useItemDrawer.getState().openMilestone(id, date),
}

const Context = createContext<RoadmapBindings>(realBindings)
export const BindingsProvider = Context.Provider
export const useBindings = () => useContext(Context)
