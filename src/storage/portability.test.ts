import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getTemplate, resolveTemplate } from '@/templates'
import { SCHEMA_VERSION } from '@/domain'
import { parseBackup, serializeBackup } from './backup'
import { freshStorage } from './helpers.test-util'
import type { Storage } from './index'

let s: Storage
beforeEach(async () => {
  s = await freshStorage()
})
afterEach(async () => {
  await s.destroy()
})

const make = async (template: string, name: string) =>
  s.createProductFromBundle(resolveTemplate(getTemplate(template)!, { product: { name } }))

describe('exporting one product', () => {
  it('holds that product and everything inside it, and no other product', async () => {
    const a = await make('feature-development', 'A')
    const b = await make('saas-product', 'B')
    const backup = await s.exportProductBackup(a.id)
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION)
    expect(backup.data.products.map((p) => p.name)).toEqual(['A'])
    expect(backup.data.initiatives.length).toBe(5)
    for (const t of [
      'objectives',
      'initiatives',
      'features',
      'roadmaps',
      'tags',
      'dependencies',
    ] as const)
      expect(backup.data[t].every((r) => (r as { productId: string }).productId === a.id)).toBe(
        true,
      )
    expect(backup.data.roadmaps.length).toBe(1)
    expect(backup.data.dependencies.length).toBeGreaterThan(0)
    // It is a normal backup: it parses and validates on its own.
    expect(() => parseBackup(serializeBackup(backup))).not.toThrow()
    expect(b.id).not.toBe(a.id)
  })
})

describe('importing alongside what is here', () => {
  it('adds the product with its own ids when nothing clashes, changing nothing else', async () => {
    const a = await make('startup-mvp', 'A')
    const file = serializeBackup(await s.exportProductBackup(a.id))
    await s.purgeProductAndHistory(a.id) // the product is gone, as if on another device
    const other = await make('quarterly', 'Other')
    const result = await s.importBackup(parseBackup(file))
    expect(result.copied).toBe(false)
    expect(result.productIds).toEqual([a.id])
    const names = (await s.products.list()).map((p) => p.name).sort()
    expect(names).toEqual(['A', 'Other'])
    expect((await s.planning.load(other.id)).initiatives.length).toBe(5) // untouched
    expect((await s.planning.load(a.id)).initiatives.length).toBe(5)
  })

  it('never overwrites: importing a product that is still here makes a separate copy with new ids and intact links', async () => {
    const a = await make('startup-mvp', 'A')
    const file = parseBackup(serializeBackup(await s.exportProductBackup(a.id)))
    const result = await s.importBackup(file)
    expect(result.copied).toBe(true)
    const copyId = result.productIds[0]!
    expect(copyId).not.toBe(a.id)
    const products = await s.products.list()
    expect(products.map((p) => p.name).sort()).toEqual(['A', 'A (imported copy)'])

    const original = await s.planning.load(a.id)
    const copy = await s.planning.load(copyId)
    expect(copy.initiatives.length).toBe(original.initiatives.length)
    const originalIds = new Set(original.initiatives.map((i) => i.id))
    expect(copy.initiatives.every((i) => !originalIds.has(i.id) && i.productId === copyId)).toBe(
      true,
    )
    // The copy's roadmap points at the copy's own items, not the original's.
    const copyItemIds = new Set(copy.initiatives.map((i) => i.id))
    expect(copy.roadmaps[0]!.entries.every((e) => copyItemIds.has(e.itemId))).toBe(true)
    // The original is exactly as it was.
    expect(original.roadmaps[0]!.entries.every((e) => originalIds.has(e.itemId))).toBe(true)
    // Importing again gives yet another copy; nothing is ever merged away.
    await s.importBackup(file)
    expect((await s.products.list()).length).toBe(3)
  })

  it('adds nothing if the file is damaged', async () => {
    const a = await make('startup-mvp', 'A')
    const backup = await s.exportProductBackup(a.id)
    const damaged = { ...backup, data: { ...backup.data, products: [{ nope: true }] } }
    await expect(s.importBackup(damaged as never)).rejects.toThrow()
    expect((await s.products.list()).length).toBe(1)
  })
})

describe('restoring, and getting back what was replaced', () => {
  it('keeps a safety copy of what a restore replaced, and can bring it back', async () => {
    await make('startup-mvp', 'Before')
    const backup = await s.exportBackup()
    await s.purgeProductAndHistory((await s.products.list())[0]!.id)
    await make('quarterly', 'Now')
    expect(await s.previousCopy()).toBeUndefined()

    await s.restoreBackup(backup) // replaces "Now" with "Before"
    expect((await s.products.list()).map((p) => p.name)).toEqual(['Before'])
    const previous = await s.previousCopy()
    expect(previous?.backup.data.products.map((p) => p.name)).toEqual(['Now'])

    await s.restoreBackup(previous!.backup) // and back again
    expect((await s.products.list()).map((p) => p.name)).toEqual(['Now'])
  })
})

describe('unsupported and unsafe files', () => {
  it('says plainly when a backup is from a newer version, not JSON, or not Ordo', () => {
    expect(() =>
      parseBackup(JSON.stringify({ app: 'ordo', schemaVersion: SCHEMA_VERSION + 1, data: {} })),
    ).toThrow(/newer version/)
    expect(() => parseBackup('not json {')).toThrow(/not valid JSON/)
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(/not an Ordo backup/)
    expect(() => parseBackup(JSON.stringify({ app: 'ordo', schemaVersion: 0, data: {} }))).toThrow(
      /version/,
    )
  })

  it('ignores a __proto__ key and does not pollute anything', () => {
    const text =
      '{"app":"ordo","schemaVersion":2,"exportedAt":"2026-01-01T00:00:00.000Z","__proto__":{"polluted":true},"data":{"__proto__":{"polluted":true},"products":[],"objectives":[],"initiatives":[],"features":[],"milestones":[],"roadmaps":[],"roadmapViews":[],"tags":[],"dependencies":[],"revisions":[],"templates":[]}}'
    parseBackup(text)
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
})

describe('erasing everything', () => {
  it('removes every product, record and setting, and the database still works', async () => {
    await make('startup-mvp', 'A')
    await s.meta.set('anything', 1)
    await s.eraseEverything()
    expect((await s.info()).counts.products).toBe(0)
    expect(await s.meta.get('anything')).toBeUndefined()
    await make('quarterly', 'Fresh')
    expect((await s.products.list()).length).toBe(1)
  })
})
