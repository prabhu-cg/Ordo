import type { EntityTable, IndexableType, Table } from 'dexie'
import type { ZodType } from 'zod'
import { newId, nowIso, type EntityType, type Revision } from '@/domain'
import type { OrdoDB } from './db'
import { guard, StorageError } from './errors'

interface Stored {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

/** What a caller supplies to create a record: everything except what the layer owns. */
export type NewRecord<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
/** What a caller may change on update. Ownership fields are not editable. */
export type RecordPatch<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>

export interface ListOptions {
  includeDeleted?: boolean
}

export interface UpdateOptions {
  /** Pass the `updatedAt` you read. If the record has changed since, the update is rejected with CONFLICT. */
  expectedUpdatedAt?: string
}

export interface RepositoryConfig<T extends Stored> {
  db: OrdoDB
  table: EntityTable<T, 'id'>
  entityType: EntityType
  schema: ZodType<T>
  /** Whether records are archived (deletedAt) rather than destroyed by `softDelete`. */
  softDelete: boolean
  /** Whether each change appends a Revision. */
  revisions: boolean
}

export interface Repository<T extends Stored> {
  create(input: NewRecord<T>, options?: { id?: string }): Promise<T>
  get(id: string, options?: ListOptions): Promise<T | undefined>
  list(options?: ListOptions): Promise<T[]>
  /** Indexed lookup, e.g. `findBy('productId', id)`. Excludes archived records unless asked. */
  findBy(index: string, value: IndexableType, options?: ListOptions): Promise<T[]>
  update(id: string, patch: RecordPatch<T>, options?: UpdateOptions): Promise<T>
  /** Archive (soft) or, when the entity is not soft-deletable, remove. */
  remove(id: string): Promise<void>
  restore(id: string): Promise<T>
  /** Permanently delete. Revisions already written are kept. */
  purge(id: string): Promise<void>
  count(options?: ListOptions): Promise<number>
}

function productIdOf(entityType: EntityType, record: Stored & { productId?: string }): string {
  return entityType === 'product' ? record.id : (record.productId ?? '')
}

export function createRepository<T extends Stored>(config: RepositoryConfig<T>): Repository<T> {
  const { db, entityType, schema, softDelete, revisions } = config
  // Generic code cannot name the table's key type; ids are always strings.
  const table = config.table as unknown as Table<T, string>
  const visible = (r: T, o?: ListOptions) => o?.includeDeleted || !r.deletedAt

  async function writeRevision(action: Revision['action'], record: T) {
    if (!revisions) return
    const productId = productIdOf(entityType, record as Stored & { productId?: string })
    await db.revisions.add({
      id: newId(),
      createdAt: nowIso(),
      productId,
      entityType,
      entityId: record.id,
      action,
      snapshot: JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
    })
  }

  const tables = () => [table, db.revisions]

  return {
    create: (input, options) =>
      guard(async () => {
        const now = nowIso()
        const record = schema.parse({
          ...input,
          id: options?.id ?? newId(),
          createdAt: now,
          updatedAt: now,
        })
        await db.transaction('rw', tables(), async () => {
          await table.add(record)
          await writeRevision('create', record)
        })
        return record
      }),

    get: (id, options) =>
      guard(async () => {
        const record = await table.get(id)
        return record && visible(record, options) ? record : undefined
      }),

    list: (options) =>
      guard(async () => (await table.toArray()).filter((r) => visible(r, options))),

    findBy: (index, value, options) =>
      guard(async () =>
        (await table.where(index).equals(value).toArray()).filter((r) => visible(r, options)),
      ),

    update: (id, patch, options) =>
      guard(() =>
        db.transaction('rw', tables(), async () => {
          const current = await table.get(id)
          if (!current) throw new StorageError('NOT_FOUND', 'That item no longer exists.')
          if (options?.expectedUpdatedAt && current.updatedAt !== options.expectedUpdatedAt) {
            throw new StorageError(
              'CONFLICT',
              'This item was changed somewhere else while you were editing.',
            )
          }
          const next = schema.parse({
            ...current,
            ...patch,
            id: current.id,
            createdAt: current.createdAt,
            deletedAt: current.deletedAt,
            updatedAt: nowIso(),
          })
          await table.put(next)
          await writeRevision('update', next)
          return next
        }),
      ),

    remove: (id) =>
      guard(() =>
        db.transaction('rw', tables(), async () => {
          const current = await table.get(id)
          if (!current) throw new StorageError('NOT_FOUND', 'That item no longer exists.')
          if (!softDelete) {
            await table.delete(id)
            await writeRevision('delete', current)
            return
          }
          if (current.deletedAt) return // already archived: removing twice is not an error
          const now = nowIso()
          const next = schema.parse({ ...current, deletedAt: now, updatedAt: now })
          await table.put(next)
          await writeRevision('delete', next)
        }),
      ),

    restore: (id) =>
      guard(() =>
        db.transaction('rw', tables(), async () => {
          if (!softDelete)
            throw new StorageError('UNKNOWN', 'This kind of item cannot be restored.')
          const current = await table.get(id)
          if (!current) throw new StorageError('NOT_FOUND', 'That item no longer exists.')
          const next = schema.parse({ ...current, deletedAt: undefined, updatedAt: nowIso() })
          await table.put(next)
          await writeRevision('restore', next)
          return next
        }),
      ),

    purge: (id) => guard(() => table.delete(id)),

    count: (options) =>
      guard(async () =>
        options?.includeDeleted
          ? table.count()
          : (await table.toArray()).filter((r) => !r.deletedAt).length,
      ),
  }
}
