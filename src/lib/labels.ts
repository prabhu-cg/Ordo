import type { Lane, PlanningHorizon, ProductCategory, WorkStatus } from '@/domain'

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
