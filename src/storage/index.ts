/**
 * Public surface of the storage layer. UI and stores import from '@/storage' only;
 * nothing outside src/storage may import Dexie or touch IndexedDB (enforced by ESLint).
 */
import { OrdoDB } from './db'
import {
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupFile,
} from './backup'
import { eraseEverything, exportProductBackup, importBackupAsNew } from './portability'
import { guard } from './errors'
import { getStorageInfo } from './info'
import { createMeta, META_KEYS, UNDO_KEY_PREFIX } from './meta'
import { createPlanning } from './planning'
import { createRepositories } from './repositories'
import { createRoadmapService } from './roadmaps'
import { createTemplateService } from './templates'

export function createStorage(db: OrdoDB = new OrdoDB()) {
  const repositories = createRepositories(db)
  return {
    db,
    ...repositories,
    planning: createPlanning(db, repositories),
    roadmapService: createRoadmapService(db, repositories),
    templateService: createTemplateService(repositories),
    meta: createMeta(db),
    /** Open the database now so failures surface at startup, not on first write. */
    open: () => guard(async () => void (await db.open())),
    close: () => db.close(),
    info: () => getStorageInfo(db),
    exportBackup: () => exportBackup(db),
    exportProductBackup: (productId: string) => exportProductBackup(db, productId),
    /** Add a backup's products alongside the existing ones. Never overwrites. */
    importBackup: (backup: BackupFile) => importBackupAsNew(db, backup),
    /**
     * Replace everything with a backup. What was here is first saved as a safety copy, so a restore can itself be
     * undone with `restorePrevious`.
     */
    restoreBackup: async (backup: BackupFile) => {
      const meta = createMeta(db)
      const before = await exportBackup(db)
      const counts = await restoreBackup(db, backup)
      await meta
        .set(META_KEYS.safetyCopy, { savedAt: before.exportedAt, text: serializeBackup(before) })
        .catch(() => undefined) // a copy that cannot be saved (quota) must not undo a restore that worked
      // Saved undo steps point at records the restore just replaced, so they could do harm. Drop them.
      await meta.removePrefix(UNDO_KEY_PREFIX)
      return counts
    },
    /** The copy of the data made just before the last restore, if there is one. */
    previousCopy: async () => {
      const saved = await createMeta(db).get<{ savedAt: string; text: string }>(
        META_KEYS.safetyCopy,
      )
      if (!saved) return undefined
      try {
        const backup = parseBackup(saved.text)
        return { savedAt: saved.savedAt, backup }
      } catch {
        return undefined
      }
    },
    /** Delete a product for good, along with its saved undo history. */
    purgeProductAndHistory: async (productId: string) => {
      await repositories.purgeProduct(productId)
      await createMeta(db).remove(`${UNDO_KEY_PREFIX}${productId}`)
    },
    /** Erase every product, record and setting. */
    eraseEverything: () => eraseEverything(db),
    /** Delete the whole database. Used by tests and by an explicit "erase everything" action. */
    destroy: () => guard(() => db.delete()),
  }
}
export type Storage = ReturnType<typeof createStorage>

export { OrdoDB, DB_NAME, DATA_TABLES, type DataTableName } from './db'
export { StorageError, toStorageError, type StorageErrorCode } from './errors'
export { DB_VERSIONS, registerVersions, type DbVersion } from './migrations'
export {
  parseBackup,
  serializeBackup,
  backupFileName,
  countBackup,
  readBackupVersion,
  type BackupFile,
  type BackupCounts,
} from './backup'
export { META_KEYS, UNDO_KEY_PREFIX } from './meta'
export { requestPersistence, type StorageInfo } from './info'
export type { NewRecord, RecordPatch, Repository } from './repository'
export type {
  DeleteStrategy,
  DependencyFields,
  FeatureFields,
  InitiativeFields,
  MilestoneFields,
  ObjectiveFields,
  PlanningData,
} from './planning'
export type { NewEntry, RoadmapFields } from './roadmaps'
export type { TemplateContent } from './templates'

let shared: Storage | undefined
/** The app-wide storage instance, created on first use. */
export function getStorage(): Storage {
  shared ??= createStorage()
  return shared
}
/** Test hook: swap the app-wide instance. */
export function setStorage(next: Storage | undefined): void {
  shared = next
}
