/**
 * Public surface of the storage layer. UI and stores import from '@/storage' only;
 * nothing outside src/storage may import Dexie or touch IndexedDB (enforced by ESLint).
 */
import { OrdoDB } from './db'
import { exportBackup, restoreBackup, type BackupFile } from './backup'
import { guard } from './errors'
import { getStorageInfo } from './info'
import { createMeta, UNDO_KEY_PREFIX } from './meta'
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
    restoreBackup: async (backup: BackupFile) => {
      const counts = await restoreBackup(db, backup)
      // Saved undo steps point at records the restore just replaced, so they could do harm. Drop them.
      await createMeta(db).removePrefix(UNDO_KEY_PREFIX)
      return counts
    },
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
