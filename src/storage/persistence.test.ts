import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { OrdoDB } from './db'
import { createStorage } from './index'
import { DB_VERSIONS, type DbVersion } from './migrations'
import { toStorageError, StorageError } from './errors'

describe('persistence across "reloads"', () => {
  it('data survives closing and reopening the database', async () => {
    const name = `ordo-persist-${Date.now()}`
    const first = createStorage(new OrdoDB(name))
    await first.open()
    const p = await first.products.create({ name: 'Survivor' })
    first.close()

    const second = createStorage(new OrdoDB(name))
    await second.open()
    expect((await second.products.get(p.id))?.name).toBe('Survivor')
    await second.destroy()
  })
})

describe('schema migrations', () => {
  it('runs an upgrade function and keeps existing records when a version is added', async () => {
    const name = `ordo-migrate-${Date.now()}`
    // An "old" install: every shipped version, with a record.
    const old = new OrdoDB(name, DB_VERSIONS)
    await old.open()
    await old.products.add({
      id: 'p1',
      name: 'Old',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    old.close()

    // The "new" release adds version 3 with an index and a data upgrade.
    const v3: DbVersion = {
      version: 3,
      stores: { products: 'id, name, updatedAt, stage' },
      upgrade: async (tx) => {
        await tx
          .table('products')
          .toCollection()
          .modify((p: Record<string, unknown>) => {
            p.stage = 'idea'
          })
      },
    }
    const upgraded = new OrdoDB(name, [...DB_VERSIONS, v3])
    await upgraded.open()
    expect(upgraded.verno).toBe(3)
    const row = (await upgraded.products.get('p1')) as unknown as Record<string, unknown>
    expect(row.name).toBe('Old')
    expect(row.stage).toBe('idea')
    await upgraded.delete()
  })
})

describe('schema 2 upgrade: scores become words', () => {
  it('converts impact, effort and confidence on existing records, and leaves the rest alone', async () => {
    const name = `ordo-v2-${Date.now()}`
    // A database exactly as version 1 left it.
    const v1 = new OrdoDB(
      name,
      DB_VERSIONS.filter((v) => v.version === 1),
    )
    await v1.open()
    const stamp = {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      productId: 'p',
    }
    await v1.table('initiatives').bulkAdd([
      {
        ...stamp,
        id: 'i1',
        title: 'A',
        status: 'idea',
        tagIds: [],
        order: 1,
        scoring: { impact: 5, effort: 2, confidence: 4 },
      },
      {
        ...stamp,
        id: 'i2',
        title: 'B',
        status: 'idea',
        tagIds: [],
        order: 2,
        scoring: { impact: 3 },
      },
      { ...stamp, id: 'i3', title: 'C', status: 'idea', tagIds: [], order: 3 },
    ])
    await v1.table('features').add({
      ...stamp,
      id: 'f1',
      title: 'F',
      status: 'idea',
      tagIds: [],
      order: 1,
      scoring: { effort: 1, confidence: 1 },
    })
    v1.close()

    const db = new OrdoDB(name)
    await db.open()
    expect(db.verno).toBe(2)
    const get = (t: 'initiatives' | 'features', id: string) =>
      db.table(t).get(id) as Promise<Record<string, unknown>>
    expect(await get('initiatives', 'i1')).toMatchObject({
      scoring: { impact: 'high', effort: 'low' },
      confidence: 'committed',
      title: 'A',
    })
    expect(await get('initiatives', 'i2')).toMatchObject({ scoring: { impact: 'medium' } })
    expect((await get('initiatives', 'i2')).confidence).toBeUndefined()
    expect((await get('initiatives', 'i3')).scoring).toBeUndefined()
    expect(await get('features', 'f1')).toMatchObject({
      scoring: { effort: 'low' },
      confidence: 'exploring',
    })
    expect(await db.templates.count()).toBe(0) // the new table exists
    await db.delete()
  })
})

describe('error mapping', () => {
  it('maps quota errors', () => {
    const e = toStorageError(new Dexie.QuotaExceededError('full'))
    expect(e).toBeInstanceOf(StorageError)
    expect(e.code).toBe('QUOTA_EXCEEDED')
    expect(e.recovery).toMatch(/backup/i)
  })
  it('maps closed/blocked databases', () => {
    expect(toStorageError(new Dexie.DatabaseClosedError()).code).toBe('UNAVAILABLE')
  })
  it('maps a downgrade to VERSION_CONFLICT', () => {
    expect(toStorageError(new Dexie.VersionError('newer')).code).toBe('VERSION_CONFLICT')
  })
  it('wraps unknown errors', () => {
    expect(toStorageError(new Error('boom')).code).toBe('UNKNOWN')
  })
})
