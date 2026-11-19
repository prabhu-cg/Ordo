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
} from '@/domain'

/** Validate a bundle against the real schemas (timestamps added). Returns a list of problems. */
export function productBundleIsValid(b: ProductBundle): string[] {
  const now = new Date().toISOString()
  const stamp = <T extends object>(row: T) => ({ ...row, createdAt: now, updatedAt: now })
  const problems: string[] = []
  const check = (
    label: string,
    schema: { safeParse: (v: unknown) => { success: boolean } },
    rows: object[],
  ) =>
    rows.forEach((r, i) => {
      if (!schema.safeParse(stamp(r)).success) problems.push(`${label}[${i}]`)
    })
  check('product', productSchema, [b.product])
  check('tags', tagSchema, b.tags)
  check('objectives', objectiveSchema, b.objectives)
  check('initiatives', initiativeSchema, b.initiatives)
  check('features', featureSchema, b.features)
  check('milestones', milestoneSchema, b.milestones)
  check('dependencies', dependencySchema, b.dependencies)
  check('roadmap', roadmapSchema, [b.roadmap])
  check('views', roadmapViewSchema, b.views)
  return problems
}
