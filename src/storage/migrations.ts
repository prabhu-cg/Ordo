import type Dexie from 'dexie'
import type { Transaction } from 'dexie'

/**
 * Database schema history. Each entry is one IndexedDB schema version.
 *
 * To change the schema:
 *   1. Append a new entry (never edit a shipped one) with ONLY the tables whose indexes change.
 *   2. Add an `upgrade` function if existing records need reshaping.
 *   3. Bump SCHEMA_VERSION in src/domain/v1/common.ts (or add a v2 domain folder) and add a
 *      backup migration in backup-migrations.ts so old backup files still restore.
 *   4. Add a test in storage/migrations.test.ts.
 */
export interface DbVersion {
  version: number
  /** Table name to index spec. `null` drops the table. */
  stores: Record<string, string | null>
  upgrade?: (tx: Transaction) => Promise<void> | void
}

export const DB_VERSIONS: DbVersion[] = [
  {
    version: 1,
    stores: {
      products: 'id, name, updatedAt',
      objectives: 'id, productId, status, [productId+order]',
      initiatives: 'id, productId, objectiveId, status, *tagIds, [productId+order]',
      features: 'id, productId, initiativeId, status, *tagIds, [productId+order]',
      milestones: 'id, productId, initiativeId, date',
      roadmaps: 'id, productId',
      roadmapViews: 'id, productId, roadmapId',
      tags: 'id, productId, [productId+name]',
      dependencies: 'id, productId, fromId, toId, [fromType+fromId], [toType+toId]',
      revisions: 'id, productId, createdAt, [entityType+entityId]',
      meta: 'key',
    },
  },
]

/** Register every version on a Dexie instance, in order. */
export function registerVersions(db: Dexie, versions: DbVersion[]): void {
  const sorted = [...versions].sort((a, b) => a.version - b.version)
  for (const v of sorted) {
    const version = db.version(v.version).stores(v.stores)
    if (v.upgrade) version.upgrade(v.upgrade)
  }
}
