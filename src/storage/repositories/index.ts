import {
  dependencySchema,
  featureSchema,
  initiativeSchema,
  milestoneSchema,
  objectiveSchema,
  productSchema,
  roadmapSchema,
  roadmapViewSchema,
  tagSchema,
  type ProductBundle,
  type Revision,
} from '@/domain'
import type { OrdoDB } from '../db'
import { guard } from '../errors'
import { createRepository } from '../repository'

function splitId<T extends { id: string }>(row: T): [Omit<T, 'id'>, { id: string }] {
  const { id, ...rest } = row
  return [rest, { id }]
}

/** One repository per entity. The only way application code reads or writes data. */
export function createRepositories(db: OrdoDB) {
  const common = { db, revisions: true } as const

  const products = createRepository({
    ...common,
    table: db.products,
    entityType: 'product',
    schema: productSchema,
    softDelete: true,
  })
  const objectives = createRepository({
    ...common,
    table: db.objectives,
    entityType: 'objective',
    schema: objectiveSchema,
    softDelete: true,
  })
  const initiatives = createRepository({
    ...common,
    table: db.initiatives,
    entityType: 'initiative',
    schema: initiativeSchema,
    softDelete: true,
  })
  const features = createRepository({
    ...common,
    table: db.features,
    entityType: 'feature',
    schema: featureSchema,
    softDelete: true,
  })
  const milestones = createRepository({
    ...common,
    table: db.milestones,
    entityType: 'milestone',
    schema: milestoneSchema,
    softDelete: true,
  })
  const roadmaps = createRepository({
    ...common,
    table: db.roadmaps,
    entityType: 'roadmap',
    schema: roadmapSchema,
    softDelete: true,
  })
  const tags = createRepository({
    ...common,
    table: db.tags,
    entityType: 'tag',
    schema: tagSchema,
    softDelete: true,
  })
  // Views and dependencies are cheap to recreate: removed outright, no archive.
  const roadmapViews = createRepository({
    ...common,
    table: db.roadmapViews,
    entityType: 'roadmapView',
    schema: roadmapViewSchema,
    softDelete: false,
  })
  const dependencies = createRepository({
    ...common,
    table: db.dependencies,
    entityType: 'dependency',
    schema: dependencySchema,
    softDelete: false,
  })

  const revisions = {
    /** Newest first. */
    forEntity: (entityType: Revision['entityType'], entityId: string) =>
      guard(async () =>
        (
          await db.revisions.where('[entityType+entityId]').equals([entityType, entityId]).toArray()
        ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    forProduct: (productId: string, limit = 100) =>
      guard(async () =>
        (await db.revisions.where('productId').equals(productId).toArray())
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit),
      ),
  }

  /** Counts of live (not archived) records inside one product. */
  const countsForProduct = (productId: string) =>
    guard(async () => {
      const live = <T extends { deletedAt?: string }>(rows: T[]) =>
        rows.filter((r) => !r.deletedAt).length
      const [o, i, f, m, r] = await Promise.all([
        db.objectives.where('productId').equals(productId).toArray(),
        db.initiatives.where('productId').equals(productId).toArray(),
        db.features.where('productId').equals(productId).toArray(),
        db.milestones.where('productId').equals(productId).toArray(),
        db.roadmaps.where('productId').equals(productId).toArray(),
      ])
      return {
        objectives: live(o),
        initiatives: live(i),
        features: live(f),
        milestones: live(m),
        roadmaps: live(r),
      }
    })

  /** Permanently delete a product and everything inside it, atomically. */
  const purgeProduct = (productId: string) =>
    guard(() =>
      db.transaction(
        'rw',
        [
          db.products,
          db.objectives,
          db.initiatives,
          db.features,
          db.milestones,
          db.roadmaps,
          db.roadmapViews,
          db.tags,
          db.dependencies,
          db.revisions,
        ],
        async () => {
          for (const t of [
            db.objectives,
            db.initiatives,
            db.features,
            db.milestones,
            db.roadmaps,
            db.roadmapViews,
            db.tags,
            db.dependencies,
            db.revisions,
          ]) {
            await t.where('productId').equals(productId).delete()
          }
          await db.products.delete(productId)
        },
      ),
    )

  /**
   * Write a whole product (and everything inside it) atomically: either all of it is saved or none.
   * Every record is validated by its repository; one invalid record aborts the lot.
   */
  const createProductFromBundle = (bundle: ProductBundle) =>
    guard(() =>
      db.transaction(
        'rw',
        [
          db.products,
          db.objectives,
          db.initiatives,
          db.features,
          db.milestones,
          db.roadmaps,
          db.roadmapViews,
          db.tags,
          db.dependencies,
          db.revisions,
        ],
        async () => {
          const each = async <T extends { id: string }>(
            create: (input: Omit<T, 'id'>, options: { id: string }) => Promise<unknown>,
            rows: T[],
          ) => {
            for (const row of rows) await create(...splitId(row))
          }
          const product = await products.create(...splitId(bundle.product))
          await each(tags.create, bundle.tags)
          await each(objectives.create, bundle.objectives)
          await each(initiatives.create, bundle.initiatives)
          await each(features.create, bundle.features)
          await each(milestones.create, bundle.milestones)
          await each(dependencies.create, bundle.dependencies)
          await roadmaps.create(...splitId(bundle.roadmap))
          await each(roadmapViews.create, bundle.views)
          return product
        },
      ),
    )

  return {
    products,
    objectives,
    initiatives,
    features,
    milestones,
    roadmaps,
    roadmapViews,
    tags,
    dependencies,
    revisions,
    countsForProduct,
    purgeProduct,
    createProductFromBundle,
  }
}

export type Repositories = ReturnType<typeof createRepositories>
