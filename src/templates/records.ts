import type {
  Draft,
  Feature,
  Initiative,
  Milestone,
  Objective,
  ProductBundle,
  Roadmap,
  RoadmapView,
  Tag,
} from '@/domain'

/** Give drafts the timestamps that real records have, so a bundle can be drawn by the same views as saved data. */
export function stampBundle(bundle: ProductBundle, at: string = new Date().toISOString()) {
  const stamp = <T extends object>(d: T) => ({ ...d, createdAt: at, updatedAt: at })
  return {
    objectives: bundle.objectives.map(stamp) as unknown as Objective[],
    initiatives: bundle.initiatives.map(stamp) as unknown as Initiative[],
    features: bundle.features.map(stamp) as unknown as Feature[],
    tags: bundle.tags.map(stamp) as unknown as Tag[],
    milestones: bundle.milestones.map(stamp) as unknown as Milestone[],
    dependencies: bundle.dependencies.map(stamp),
    roadmap: stamp(bundle.roadmap) as unknown as Roadmap,
    views: bundle.views.map(stamp) as unknown as RoadmapView[],
  }
}

export type StampedBundle = ReturnType<typeof stampBundle>
export type { Draft }
