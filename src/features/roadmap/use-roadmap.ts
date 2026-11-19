import { useMemo } from 'react'
import { useFilters } from '@/features/planning/use-filters'
import { usePlanningStore } from '@/store/planning-store'
import { buildRows, filterRows, linkSummaries, visibleRows, type RoadmapRow } from './engine'

/**
 * The one way any roadmap screen reads its data: this roadmap's entries joined to the shared initiatives and
 * features. Whatever the view, the rows come from here, so no view can show something another does not have.
 */
export function useRoadmapData(roadmapId: string | undefined) {
  const { roadmaps, initiatives, features, objectives, milestones, dependencies, views, tags } =
    usePlanningStore()
  const { filters, set, clear } = useFilters()
  const roadmap = roadmaps.find((r) => r.id === roadmapId)

  const rows = useMemo<RoadmapRow[]>(
    () => (roadmap ? visibleRows(roadmap, buildRows(roadmap, initiatives, features)) : []),
    [roadmap, initiatives, features],
  )

  // A bookmark may name an initiative that has since been deleted: treat that as "any".
  const initiativeFilter =
    filters.initiative === 'none' || initiatives.some((i) => i.id === filters.initiative)
      ? filters.initiative
      : ''
  const rowFilters = useMemo(
    () => ({
      q: filters.q,
      status: filters.status,
      priority: filters.priority,
      initiative: initiativeFilter,
    }),
    [filters.q, filters.status, filters.priority, initiativeFilter],
  )
  const filtered = useMemo(
    () => filterRows(rows, rowFilters, initiatives),
    [rows, rowFilters, initiatives],
  )
  const filtering = Boolean(
    rowFilters.q.trim() || rowFilters.status || rowFilters.priority || rowFilters.initiative,
  )

  const links = useMemo(
    () =>
      linkSummaries(dependencies, (type, id) => {
        const item =
          type === 'initiative'
            ? initiatives.find((i) => i.id === id)
            : features.find((f) => f.id === id)
        return item && !item.deletedAt ? { title: item.title, status: item.status } : undefined
      }),
    [dependencies, initiatives, features],
  )

  return {
    links,
    roadmap,
    rows,
    filtered,
    filtering,
    filters: { ...filters, initiative: initiativeFilter },
    setFilter: set,
    clearFilters: clear,
    initiatives,
    features,
    objectives,
    milestones:
      roadmap && (roadmap.itemTypes ?? ['milestone']).includes('milestone') ? milestones : [],
    dependencies,
    tags,
    views: views.filter((v) => v.roadmapId === roadmapId),
  }
}

/** What every roadmap view is given: the real thing in the app, a throwaway copy in a template preview. */
export type RoadmapData = ReturnType<typeof useRoadmapData>
