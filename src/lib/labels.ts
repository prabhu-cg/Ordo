import type {
  Confidence,
  Lane,
  Level,
  PlanningHorizon,
  Priority,
  ProductCategory,
  WorkStatus,
} from '@/domain'

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  saas: 'Software as a service',
  'mobile-app': 'Mobile app',
  'developer-tool': 'Developer tool',
  marketplace: 'Marketplace',
  content: 'Content or media',
  hardware: 'Hardware',
  service: 'Service or consulting',
  other: 'Something else',
}

export const HORIZON_LABELS: Record<PlanningHorizon, string> = {
  '3-months': 'The next 3 months',
  '6-months': 'The next 6 months',
  '12-months': 'The next 12 months',
  '2-years': 'The next 2 years',
}

export const STATUS_LABELS: Record<WorkStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  'in-progress': 'In progress',
  shipped: 'Shipped',
  paused: 'Paused',
  dropped: 'Dropped',
}

export const STATUS_BADGE: Record<
  WorkStatus,
  'secondary' | 'info' | 'soft' | 'success' | 'warning' | 'destructive'
> = {
  idea: 'secondary',
  planned: 'info',
  'in-progress': 'soft',
  shipped: 'success',
  paused: 'warning',
  dropped: 'destructive',
}

export const LANE_LABELS: Record<Lane, string> = { now: 'Now', next: 'Next', later: 'Later' }

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}
export const PRIORITY_BADGE: Record<Priority, 'secondary' | 'info' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  critical: 'destructive',
}

export const OBJECTIVE_STATUS_LABELS = {
  active: 'Active',
  achieved: 'Achieved',
  dropped: 'Dropped',
} as const
export const OBJECTIVE_STATUS_BADGE = {
  active: 'soft',
  achieved: 'success',
  dropped: 'secondary',
} as const

export const LEVEL_LABELS: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High' }
/** For sorting: low is 1, high is 3. */
export const LEVEL_RANK: Record<Level, number> = { low: 1, medium: 2, high: 3 }

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  exploring: 'Exploring',
  tentative: 'Tentative',
  committed: 'Committed',
}
/** What each confidence label means, shown in tooltips next to the label. */
export const CONFIDENCE_HELP: Record<Confidence, string> = {
  exploring: 'An idea we are looking into. Nothing is decided and it may change or be dropped.',
  tentative: 'We intend to do this, but the scope or timing may still change.',
  committed: 'We have decided to do this and are planning around it.',
}
export const CONFIDENCE_BADGE: Record<Confidence, 'secondary' | 'warning' | 'success'> = {
  exploring: 'secondary',
  tentative: 'warning',
  committed: 'success',
}
export const CONFIDENCE_RANK: Record<Confidence, number> = {
  exploring: 1,
  tentative: 2,
  committed: 3,
}
