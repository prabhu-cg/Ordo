import { create } from 'zustand'
import type { Dependency } from '@/domain'
import { getStorage, UNDO_KEY_PREFIX } from '@/storage'

/**
 * One step of putting things back. These are plain data, not functions, so a history can be saved and still work
 * after a reload.
 */
export type UndoOp =
  | { t: 'patch'; kind: 'initiative' | 'feature'; id: string; before: Record<string, unknown> }
  | { t: 'entries'; roadmapId: string; entries: unknown[] }
  | { t: 'dep-delete'; id: string }
  | {
      t: 'dep-create'
      fields: Pick<Dependency, 'fromType' | 'fromId' | 'toType' | 'toId' | 'kind' | 'note'>
    }
  | { t: 'roadmap-restore'; id: string }
  | { t: 'milestone-restore'; id: string }

export interface UndoEntry {
  id: number
  label: string
  /** Run in order to put things back. */
  ops: UndoOp[]
}

/** Carries out ops. Supplied by the roadmap actions, which know how to write to storage. */
export type UndoRunner = (ops: UndoOp[]) => Promise<void>

interface UndoState {
  productId?: string
  stack: UndoEntry[]
  push: (label: string, ops: UndoOp[]) => UndoEntry
  /** Undo the most recent change. Returns what was undone, or undefined when there was nothing to undo. */
  undoLast: (run: UndoRunner) => Promise<string | undefined>
  /** Undo one specific change (the toast's button), only if nothing newer has been made since. */
  undoEntry: (id: number, run: UndoRunner) => Promise<boolean>
  /** Start the history of a product: empty, then filled from what was saved for it. */
  switchTo: (productId: string | undefined) => void
  /** Forget this product's history (memory and saved copy). */
  clear: () => void
}

const LIMIT = 30
const keyFor = (productId: string) => `${UNDO_KEY_PREFIX}${productId}`

/**
 * The history of undoable edits for the product that is open. It is saved in the browser's database as it
 * changes, so closing the tab or reloading does not lose it. Each product has its own.
 */
export const useUndoStore = create<UndoState>((set, get) => {
  const persist = () => {
    const { productId, stack } = get()
    if (!productId) return
    const meta = getStorage().meta
    void (stack.length ? meta.set(keyFor(productId), stack) : meta.remove(keyFor(productId))).catch(
      () => undefined, // history is a convenience: failing to save it must never break an edit
    )
  }
  const nextId = () => Math.max(0, ...get().stack.map((e) => e.id)) + 1

  return {
    stack: [],
    push: (label, ops) => {
      const entry = { id: nextId(), label, ops }
      set((s) => ({ stack: [...s.stack, entry].slice(-LIMIT) }))
      persist()
      return entry
    },
    undoLast: async (run) => {
      const entry = get().stack.at(-1)
      if (!entry) return undefined
      set((s) => ({ stack: s.stack.filter((e) => e.id !== entry.id) }))
      persist() // taken off the history first: a step that fails is not offered again
      await run(entry.ops)
      return entry.label
    },
    undoEntry: async (id, run) => {
      if (get().stack.at(-1)?.id !== id) return false
      await get().undoLast(run)
      return true
    },
    switchTo: (productId) => {
      if (get().productId === productId) return
      set({ productId, stack: [] })
      if (!productId) return
      void getStorage()
        .meta.get<UndoEntry[]>(keyFor(productId))
        .then((saved) => {
          // Only if this product is still the open one, and keep anything done while it was loading.
          if (get().productId !== productId || !Array.isArray(saved)) return
          set((s) => ({ stack: [...saved, ...s.stack].slice(-LIMIT) }))
        })
        .catch(() => undefined)
    },
    clear: () => {
      set({ stack: [] })
      persist()
    },
  }
})
