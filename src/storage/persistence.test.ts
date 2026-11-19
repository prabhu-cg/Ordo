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
    // An "old" install: only version 1, with a record.
    const old = new OrdoDB(name, DB_VERSIONS)
    await old.open()
    await old.products.add({
      id: 'p1',
      name: 'Old',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    old.close()

    // The "new" release adds version 2 with an index and a data upgrade.
    const v2: DbVersion = {
      version: 2,
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
    const upgraded = new OrdoDB(name, [...DB_VERSIONS, v2])
    await upgraded.open()
    expect(upgraded.verno).toBe(2)
    const row = (await upgraded.products.get('p1')) as unknown as Record<string, unknown>
    expect(row.name).toBe('Old')
    expect(row.stage).toBe('idea')
    await upgraded.delete()
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
