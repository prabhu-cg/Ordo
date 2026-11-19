import { z } from 'zod'
import {
  SCHEMA_VERSION,
  dependencySchema,
  featureSchema,
  initiativeSchema,
  isoDate,
  milestoneSchema,
  nowIso,
  objectiveSchema,
  productSchema,
  revisionSchema,
  roadmapSchema,
  roadmapViewSchema,
  tagSchema,
} from '@/domain'
import { DATA_TABLES, type DataTableName, type OrdoDB } from './db'
import { guard, StorageError } from './errors'

export const BACKUP_APP = 'ordo'

const dataSchema = z.object({
  products: z.array(productSchema),
  objectives: z.array(objectiveSchema),
  initiatives: z.array(initiativeSchema),
  features: z.array(featureSchema),
  milestones: z.array(milestoneSchema),
  roadmaps: z.array(roadmapSchema),
  roadmapViews: z.array(roadmapViewSchema),
  tags: z.array(tagSchema),
  dependencies: z.array(dependencySchema),
  revisions: z.array(revisionSchema),
})

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  schemaVersion: z.number().int().min(1),
  exportedAt: isoDate,
  data: dataSchema,
})
export type BackupFile = z.infer<typeof backupSchema>
export type BackupCounts = Record<DataTableName, number>

/**
 * Upgrades from one backup schema version to the next. Add `[n]: (data) => ...` when SCHEMA_VERSION
 * moves from n to n+1, so backups made by older releases keep restoring.
 */
export const BACKUP_MIGRATIONS: Record<
  number,
  (data: Record<string, unknown>) => Record<string, unknown>
> = {}

export function countBackup(backup: BackupFile): BackupCounts {
  return Object.fromEntries(DATA_TABLES.map((t) => [t, backup.data[t].length])) as BackupCounts
}

/** Read every table in one consistent snapshot. */
export function exportBackup(db: OrdoDB): Promise<BackupFile> {
  return guard(() =>
    db.transaction(
      'r',
      DATA_TABLES.map((t) => db[t]),
      async () => {
        const entries = await Promise.all(
          DATA_TABLES.map(async (t) => [t, await db[t].toArray()] as const),
        )
        return {
          app: BACKUP_APP,
          schemaVersion: SCHEMA_VERSION,
          exportedAt: nowIso(),
          data: Object.fromEntries(entries) as BackupFile['data'],
        }
      },
    ),
  )
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `ordo-backup-${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}.json`
}

const invalid = (message: string, cause?: unknown) =>
  new StorageError('INVALID_BACKUP', message, { cause })

/** Every reference must point at a record that exists in the same backup. */
function findIntegrityProblems(data: BackupFile['data']): string[] {
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id))
  const products = ids(data.products)
  const objectives = ids(data.objectives)
  const initiatives = ids(data.initiatives)
  const features = ids(data.features)
  const roadmaps = ids(data.roadmaps)
  const tags = ids(data.tags)
  const problems: string[] = []

  for (const table of DATA_TABLES) {
    const seen = new Set<string>()
    for (const row of data[table]) {
      if (seen.has(row.id)) problems.push(`Duplicate id in ${table}`)
      seen.add(row.id)
    }
  }

  const needProduct = (label: string, rows: { productId: string }[]) => {
    if (rows.some((r) => !products.has(r.productId)))
      problems.push(`${label} refer to a missing product`)
  }
  needProduct('Objectives', data.objectives)
  needProduct('Initiatives', data.initiatives)
  needProduct('Features', data.features)
  needProduct('Milestones', data.milestones)
  needProduct('Roadmaps', data.roadmaps)
  needProduct('Roadmap views', data.roadmapViews)
  needProduct('Tags', data.tags)
  needProduct('Dependencies', data.dependencies)

  if (data.initiatives.some((r) => r.objectiveId && !objectives.has(r.objectiveId)))
    problems.push('Initiatives refer to a missing objective')
  if (data.features.some((r) => r.initiativeId && !initiatives.has(r.initiativeId)))
    problems.push('Features refer to a missing initiative')
  if (data.milestones.some((r) => r.initiativeId && !initiatives.has(r.initiativeId)))
    problems.push('Milestones refer to a missing initiative')
  if (data.roadmapViews.some((r) => !roadmaps.has(r.roadmapId)))
    problems.push('Roadmap views refer to a missing roadmap')
  if ([...data.initiatives, ...data.features].some((r) => r.tagIds.some((t) => !tags.has(t))))
    problems.push('Items refer to a missing tag')
  for (const roadmap of data.roadmaps) {
    if (
      roadmap.entries.some(
        (e) => !(e.itemType === 'initiative' ? initiatives : features).has(e.itemId),
      )
    ) {
      problems.push('A roadmap refers to a missing initiative or feature')
      break
    }
  }
  return problems
}

/**
 * Turn untrusted file text into a trusted BackupFile: parse, migrate to the current version,
 * validate every record, then check references. Throws INVALID_BACKUP with a readable reason.
 * Nothing is written here.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (cause) {
    throw invalid('That file is not valid JSON.', cause)
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== BACKUP_APP) {
    throw invalid('That file is not an Ordo backup.')
  }

  const envelope = raw as { schemaVersion?: unknown; data?: unknown }
  let version = envelope.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw invalid('This backup has no valid version number.')
  }
  if (version > SCHEMA_VERSION) {
    throw invalid('This backup was made by a newer version of Ordo. Update Ordo, then try again.')
  }
  let data = envelope.data as Record<string, unknown>
  if (typeof data !== 'object' || data === null) throw invalid('This backup has no data.')
  while (version < SCHEMA_VERSION) {
    const step = BACKUP_MIGRATIONS[version]
    if (!step) throw invalid(`This backup (version ${version}) cannot be upgraded.`)
    data = step(data)
    version += 1
  }

  const parsed = backupSchema.safeParse({ ...(raw as object), schemaVersion: version, data })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first ? ` (${first.path.slice(0, 3).join(' › ')})` : ''
    throw invalid(`This backup is damaged or incomplete${where}.`, parsed.error)
  }
  const problems = findIntegrityProblems(parsed.data.data)
  if (problems.length > 0) throw invalid(`This backup is inconsistent: ${problems[0]}.`)
  return parsed.data
}

/**
 * Replace everything in the database with the backup, atomically. If anything fails the
 * transaction rolls back and the existing data is untouched.
 */
export function restoreBackup(db: OrdoDB, backup: BackupFile): Promise<BackupCounts> {
  return guard(async () => {
    // Re-validate: callers may hand us an object that did not come from parseBackup.
    const safe = backupSchema.parse(backup)
    await db.transaction(
      'rw',
      DATA_TABLES.map((t) => db[t]),
      async () => {
        for (const t of DATA_TABLES) {
          await db[t].clear()
          // The union of table row types cannot be expressed per-iteration; schema validation above is the guarantee.
          await (db[t] as unknown as { bulkAdd: (rows: unknown[]) => Promise<unknown> }).bulkAdd(
            safe.data[t],
          )
        }
      },
    )
    return countBackup(safe)
  })
}
