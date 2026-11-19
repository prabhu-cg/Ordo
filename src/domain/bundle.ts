import type {
  Dependency,
  Feature,
  Initiative,
  Milestone,
  Objective,
  Product,
  Roadmap,
  RoadmapView,
  Tag,
} from './schema'

/** A record as authored: it has an id but the storage layer owns timestamps and archive state. */
export type Draft<T> = Omit<T, 'createdAt' | 'updatedAt' | 'deletedAt'>

/**
 * A complete product with everything inside it, ready to be written in one transaction.
 * Templates resolve into this; the sample roadmap is rendered from the same shape without being saved.
 */
export interface ProductBundle {
  product: Draft<Product>
  tags: Draft<Tag>[]
  objectives: Draft<Objective>[]
  initiatives: Draft<Initiative>[]
  features: Draft<Feature>[]
  milestones: Draft<Milestone>[]
  dependencies: Draft<Dependency>[]
  roadmap: Draft<Roadmap>
  views: Draft<RoadmapView>[]
}
