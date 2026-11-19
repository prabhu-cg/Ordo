import Dexie, { type EntityTable } from 'dexie'
import type {
  Dependency,
  Feature,
  Initiative,
  Milestone,
  Objective,
  Product,
  Revision,
  Roadmap,
  RoadmapView,
  Tag,
} from '@/domain'
import { DB_VERSIONS, registerVersions, type DbVersion } from './migrations'

export const DB_NAME = 'ordo'

export interface MetaRecord {
  key: string
  value: unknown
}

/** Tables that hold user data (everything except `meta`). Backup and restore cover exactly these. */
export const DATA_TABLES = [
  'products',
  'objectives',
  'initiatives',
  'features',
  'milestones',
  'roadmaps',
  'roadmapViews',
  'tags',
  'dependencies',
  'revisions',
] as const
export type DataTableName = (typeof DATA_TABLES)[number]

export class OrdoDB extends Dexie {
  products!: EntityTable<Product, 'id'>
  objectives!: EntityTable<Objective, 'id'>
  initiatives!: EntityTable<Initiative, 'id'>
  features!: EntityTable<Feature, 'id'>
  milestones!: EntityTable<Milestone, 'id'>
  roadmaps!: EntityTable<Roadmap, 'id'>
  roadmapViews!: EntityTable<RoadmapView, 'id'>
  tags!: EntityTable<Tag, 'id'>
  dependencies!: EntityTable<Dependency, 'id'>
  revisions!: EntityTable<Revision, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor(name: string = DB_NAME, versions: DbVersion[] = DB_VERSIONS) {
    super(name)
    registerVersions(this, versions)
  }
}
