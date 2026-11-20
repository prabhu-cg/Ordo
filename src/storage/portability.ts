import { newId } from '@/domain'
import {
  backupSchema,
  countBackup,
  exportBackup,
  type BackupCounts,
  type BackupFile,
} from './backup'
import { DATA_TABLES, type OrdoDB } from './db'
import { guard } from './errors'

/** The rows of one product, and nothing else: a backup of just that product. */
export async function exportProductBackup(db: OrdoDB, productId: string): Promise<BackupFile> {
  const all = await exportBackup(db)
  const product = all.data.products.find((p) => p.id === productId)
  if (!product) throw new Error('That product no longer exists.')
  const ofProduct = <T extends { productId: string }>(rows: T[]) =>
    rows.filter((r) => r.productId === productId)
  return {
    ...all,
    data: {
      products: [product],
      objectives: ofProduct(all.data.objectives),
      initiatives: ofProduct(all.data.initiatives),
      features: ofProduct(all.data.features),
      milestones: ofProduct(all.data.milestones),
      roadmaps: ofProduct(all.data.roadmaps),
      roadmapViews: ofProduct(all.data.roadmapViews),
      tags: ofProduct(all.data.tags),
      dependencies: ofProduct(all.data.dependencies),
      revisions: ofProduct(all.data.revisions),
      // Custom templates belong to the person, not to a product.
      templates: [],
    },
  }
}

/** Give every record a new id, rewriting every reference to it. Pure. */
export function remapIds(backup: BackupFile): BackupFile {
  const map = new Map<string, string>()
  for (const t of DATA_TABLES) for (const row of backup.data[t]) map.set(row.id, newId())
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return map.get(v) ?? v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object')
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(backup) as BackupFile
}

/** Whether any record in the backup has the same id as a record already here. */
export async function findCollisions(db: OrdoDB, backup: BackupFile): Promise<number> {
  let n = 0
  for (const t of DATA_TABLES) {
    const ids = backup.data[t].map((r) => r.id)
    n += (await db[t].bulkGet(ids)).filter(Boolean).length
  }
  return n
}

export interface ImportResult {
  counts: BackupCounts
  /** The products that were added. */
  productIds: string[]
  /** True when some ids were already in use here, so everything was given new ones and the products renamed. */
  copied: boolean
}

/**
 * Add the contents of a backup alongside what is already here. Nothing existing is changed or removed. If the
 * backup holds records with ids that are already in use (the same backup imported twice, or a product that
 * is still here) every record gets a new id and the products are marked as imported copies, so an import can
 * never overwrite anything. It all happens in one transaction: on failure nothing is added.
 */
export function importBackupAsNew(db: OrdoDB, backup: BackupFile): Promise<ImportResult> {
  return guard(async () => {
    const safe = backupSchema.parse(backup) // do not trust the caller
    return db.transaction(
      'rw',
      DATA_TABLES.map((t) => db[t]),
      async () => {
        const copied = (await findCollisions(db, safe)) > 0
        const source = copied ? remapIds(safe) : safe
        if (copied)
          source.data.products = source.data.products.map((p) => ({
            ...p,
            name: `${p.name} (imported copy)`.slice(0, 200),
          }))
        for (const t of DATA_TABLES) {
          await (db[t] as unknown as { bulkAdd: (rows: unknown[]) => Promise<unknown> }).bulkAdd(
            source.data[t],
          )
        }
        return {
          counts: countBackup(source),
          productIds: source.data.products.map((p) => p.id),
          copied,
        }
      },
    )
  })
}

/** Remove every product, every record, and every saved setting. The database is left empty but usable. */
export function eraseEverything(db: OrdoDB): Promise<void> {
  return guard(() =>
    db.transaction('rw', [...DATA_TABLES.map((t) => db[t]), db.meta], async () => {
      for (const t of DATA_TABLES) await db[t].clear()
      await db.meta.clear()
    }),
  )
}
