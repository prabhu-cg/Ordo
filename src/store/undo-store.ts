import { create } from 'zustand'

export interface UndoEntry {
  id: number
  label: string
  /** Puts things back the way they were. */
  undo: () => Promise<void>
}

interface UndoState {
  stack: UndoEntry[]
  push: (label: string, undo: () => Promise<void>) => UndoEntry
  /** Undo the most recent change. Returns what was undone, or undefined when there was nothing to undo. */
  undoLast: () => Promise<string | undefined>
  /** Undo one specific change (the toast's button), only if nothing newer has been made since. */
  undoEntry: (id: number) => Promise<boolean>
  clear: () => void
}

const LIMIT = 30
let next = 1

/** The history of undoable edits for the product that is open. It is not saved: a reload starts fresh. */
export const useUndoStore = create<UndoState>((set, get) => ({
  stack: [],
  push: (label, undo) => {
    const entry = { id: next++, label, undo }
    set((s) => ({ stack: [...s.stack, entry].slice(-LIMIT) }))
    return entry
  },
  undoLast: async () => {
    const entry = get().stack.at(-1)
    if (!entry) return undefined
    set((s) => ({ stack: s.stack.filter((e) => e.id !== entry.id) }))
    await entry.undo()
    return entry.label
  },
  undoEntry: async (id) => {
    if (get().stack.at(-1)?.id !== id) return false
    await get().undoLast()
    return true
  },
  clear: () => set({ stack: [] }),
}))
