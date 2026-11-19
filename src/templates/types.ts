import type { Lane, PlanningHorizon, ProductCategory, Scoring, Tag, WorkStatus } from '@/domain'

/**
 * A starter roadmap, authored as plain data. Templates are read-only: using one copies it into a new
 * product (see resolveTemplate); the definition itself is never edited or saved.
 *
 * Dates are month offsets from the moment the template is used (0 = this month), so a template is
 * always relevant whenever it is started.
 */
export interface TemplateFeature {
  title: string
  description?: string
  status: WorkStatus
}

export interface TemplateInitiative {
  key: string
  objective: string
  title: string
  description: string
  status: WorkStatus
  lane: Lane
  /** First and last month of the work, as offsets from now. */
  months: [start: number, end: number]
  scoring: Required<Scoring>
  tags?: string[]
  features: TemplateFeature[]
}

export interface TemplateDefinition {
  id: string
  name: string
  summary: string
  bestFor: string
  category: ProductCategory
  horizon: PlanningHorizon
  tags: { name: string; tone: Tag['tone'] }[]
  objectives: { key: string; title: string; description: string }[]
  initiatives: TemplateInitiative[]
  milestones: { title: string; month: number; initiative?: string }[]
}
