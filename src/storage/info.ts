import { SCHEMA_VERSION } from '@/domain'
import { DATA_TABLES, type DataTableName, type OrdoDB } from './db'
import { guard } from './errors'

export interface StorageInfo {
  databaseName: string
  /** Version of the IndexedDB schema as opened. */
  databaseVersion: number
  /** Version of the domain/backup schema this build writes. */
  schemaVersion: number
  counts: Record<DataTableName, number>
  /** Bytes used and available to this origin, when the browser reports it. */
  usage?: number
  quota?: number
  /** Whether the browser has promised not to evict this data under storage pressure. */
  persisted?: boolean
}

export function getStorageInfo(db: OrdoDB): Promise<StorageInfo> {
  return guard(async () => {
    const counts = Object.fromEntries(
      await Promise.all(DATA_TABLES.map(async (t) => [t, await db[t].count()] as const)),
    ) as Record<DataTableName, number>

    const info: StorageInfo = {
      databaseName: db.name,
      databaseVersion: db.verno,
      schemaVersion: SCHEMA_VERSION,
      counts,
    }
    if (typeof navigator !== 'undefined' && navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate?.()
        info.usage = estimate?.usage
        info.quota = estimate?.quota
        info.persisted = await navigator.storage.persisted?.()
      } catch {
        // Estimates are a courtesy; never fail the page over them.
      }
    }
    return info
  })
}

/** Ask the browser to protect this data from automatic eviction. Returns whether it was granted. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  return navigator.storage.persist()
}
