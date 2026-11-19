import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Storage } from './index'
import { backupFileName, countBackup, parseBackup, serializeBackup } from './backup'
import { featureInput, freshStorage, initiativeInput, objectiveInput } from './helpers.test-util'

let s: Storage
beforeEach(async () => {
  s = await freshStorage()
})
afterEach(async () => {
  await s.destroy()
})

async function seed() {
  const p = await s.products.create({ name: 'Atlas', vision: 'Plan well' })
  const o = await s.objectives.create(objectiveInput(p.id))
  const tag = await s.tags.create({ productId: p.id, name: 'Growth', tone: 'amber' })
  const i = await s.initiatives.create(
    initiativeInput(p.id, { objectiveId: o.id, tagIds: [tag.id] }),
  )
  const f = await s.features.create(featureInput(p.id, { initiativeId: i.id }))
  await s.roadmaps.create({
    productId: p.id,
    name: 'Main',
    entries: [{ itemType: 'feature', itemId: f.id, order: 1 }],
  })
  return p
}

describe('backup', () => {
  it('exports every table and round-trips through text', async () => {
    await seed()
    const backup = await s.exportBackup()
    expect(backup.app).toBe('ordo')
    expect(backup.schemaVersion).toBe(1)
    const counts = countBackup(parseBackup(serializeBackup(backup)))
    expect(counts).toMatchObject({
      products: 1,
      objectives: 1,
      initiatives: 1,
      features: 1,
      tags: 1,
      roadmaps: 1,
    })
    expect(counts.revisions).toBeGreaterThan(0)
  })

  it('restores into an empty database', async () => {
    await seed()
    const text = serializeBackup(await s.exportBackup())
    const other = await freshStorage()
    const counts = await other.restoreBackup(parseBackup(text))
    expect(counts.products).toBe(1)
    expect((await other.products.list())[0]?.name).toBe('Atlas')
    expect(await other.features.list()).toHaveLength(1)
    await other.destroy()
  })

  it('replaces existing data on restore', async () => {
    const text = serializeBackup(
      await (async () => {
        await seed()
        return s.exportBackup()
      })(),
    )
    await s.products.create({ name: 'Added after backup' })
    expect(await s.products.list()).toHaveLength(2)
    await s.restoreBackup(parseBackup(text))
    expect((await s.products.list()).map((p) => p.name)).toEqual(['Atlas'])
  })

  it('names files by UTC date', () => {
    expect(backupFileName(new Date('2026-03-05T23:30:00Z'))).toBe('ordo-backup-2026-03-05.json')
  })
})

describe('parseBackup rejects untrusted input', () => {
  const good = async () => {
    await seed()
    return JSON.parse(serializeBackup(await s.exportBackup()))
  }

  it.each([
    ['not json', 'hello', /valid JSON/],
    ['not an ordo file', JSON.stringify({ app: 'other' }), /not an Ordo backup/],
    ['array', '[]', /not an Ordo backup/],
  ])('%s', (_n, text, message) => {
    expect(() => parseBackup(text as string)).toThrow(message)
  })

  it('rejects a newer schema version', async () => {
    const b = await good()
    b.schemaVersion = 99
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/newer version/)
  })

  it('rejects invalid records', async () => {
    const b = await good()
    b.data.products[0].name = ''
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/damaged or incomplete/)
  })

  it('rejects dangling references', async () => {
    const b = await good()
    b.data.features[0].initiativeId = 'ghost'
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/inconsistent/)
  })

  it('rejects duplicate ids', async () => {
    const b = await good()
    b.data.products.push({ ...b.data.products[0] })
    expect(() => parseBackup(JSON.stringify(b))).toThrow(/inconsistent/)
  })

  it('a failed restore leaves existing data untouched', async () => {
    await seed()
    const b = parseBackup(serializeBackup(await s.exportBackup()))
    const broken = structuredClone(b)
    broken.data.products[0]!.name = ''
    await expect(s.restoreBackup(broken)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await s.products.list()).toHaveLength(1)
    expect(await s.features.list()).toHaveLength(1)
  })
})
