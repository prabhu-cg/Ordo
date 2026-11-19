import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdoDB, createStorage, setStorage, type Storage } from '@/storage'
import { useUndoStore, type UndoRunner } from './undo-store'

const settle = () => new Promise((r) => setTimeout(r, 30))
let storage: Storage
let name: string

beforeEach(async () => {
  name = `ordo-undo-${Date.now()}-${Math.random()}`
  storage = createStorage(new OrdoDB(name))
  await storage.open()
  setStorage(storage)
  useUndoStore.setState({ productId: undefined, stack: [] })
})
afterEach(async () => {
  setStorage(undefined)
  await storage.destroy()
})

/** A reload: the in-memory history is gone, the database is not. */
const reload = () => {
  useUndoStore.setState({ productId: undefined, stack: [] })
}

describe('undo history', () => {
  it('survives a reload and can then be run', async () => {
    useUndoStore.getState().switchTo('p1')
    useUndoStore.getState().push('Moved a card', [{ t: 'dep-delete', id: 'd1' }])
    useUndoStore.getState().push('Changed a status', [{ t: 'roadmap-restore', id: 'r1' }])
    await settle()
    reload()
    useUndoStore.getState().switchTo('p1')
    await settle()
    expect(useUndoStore.getState().stack.map((e) => e.label)).toEqual([
      'Moved a card',
      'Changed a status',
    ])

    const run = vi.fn<UndoRunner>(async () => undefined)
    expect(await useUndoStore.getState().undoLast(run)).toBe('Changed a status')
    expect(run).toHaveBeenCalledWith([{ t: 'roadmap-restore', id: 'r1' }])
  })

  it('keeps each product its own, and ids stay unique after a reload', async () => {
    useUndoStore.getState().switchTo('a')
    useUndoStore.getState().push('In A', [])
    await settle()
    useUndoStore.getState().switchTo('b')
    expect(useUndoStore.getState().stack).toHaveLength(0)
    await settle()
    useUndoStore.getState().switchTo('a')
    await settle()
    expect(useUndoStore.getState().stack.map((e) => e.label)).toEqual(['In A'])
    const e = useUndoStore.getState().push('Next', [])
    expect(e.id).toBeGreaterThan(useUndoStore.getState().stack[0]!.id)
  })

  it('an undone step is gone for good, including from the saved copy', async () => {
    useUndoStore.getState().switchTo('p1')
    useUndoStore.getState().push('One', [])
    await useUndoStore.getState().undoLast(async () => undefined)
    await settle()
    reload()
    useUndoStore.getState().switchTo('p1')
    await settle()
    expect(useUndoStore.getState().stack).toHaveLength(0)
  })

  it('a step that fails is not offered again', async () => {
    useUndoStore.getState().switchTo('p1')
    useUndoStore.getState().push('Doomed', [])
    await expect(
      useUndoStore.getState().undoLast(async () => {
        throw new Error('record is gone')
      }),
    ).rejects.toThrow()
    expect(useUndoStore.getState().stack).toHaveLength(0)
  })

  it('restoring a backup drops saved history, which would point at replaced records', async () => {
    const p = await storage.products.create({ name: 'P' })
    useUndoStore.getState().switchTo(p.id)
    useUndoStore.getState().push('Old', [])
    await settle()
    await storage.restoreBackup(await storage.exportBackup())
    reload()
    useUndoStore.getState().switchTo(p.id)
    await settle()
    expect(useUndoStore.getState().stack).toHaveLength(0)
  })
})
