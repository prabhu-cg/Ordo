import { Layers, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { formatDate, pluralise } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { FilterBar } from './filter-bar'
import { PlanningGate } from './planning-gate'
import { NONE, SORT_OPTIONS, WORK_STATUS_OPTIONS, filterInitiatives } from './query'
import { useFilters } from './use-filters'
import { ConfidenceBadge, LevelText, PriorityBadge } from '@/components/domain/indicators'
import { StatusBadge, TableFrame, TagList, td, th } from './work-table'

export function InitiativesPage() {
  usePageTitle('Initiatives')
  return (
    <PlanningGate title="Initiatives">
      <InitiativesContent />
    </PlanningGate>
  )
}

function InitiativesContent() {
  const { objectives, initiatives, features, tags } = usePlanningStore()
  const open = useItemDrawer((s) => s.open)
  const { filters: raw, set, clear } = useFilters()
  // A link or bookmark may name an objective or tag that has since been deleted: treat that as "any".
  const filters = useMemo(
    () => ({
      ...raw,
      objective:
        raw.objective === NONE || objectives.some((o) => o.id === raw.objective)
          ? raw.objective
          : '',
      tag: tags.some((t) => t.id === raw.tag) ? raw.tag : '',
    }),
    [raw, objectives, tags],
  )
  const ctx = useMemo(() => ({ objectives, initiatives, tags }), [objectives, initiatives, tags])
  const shown = useMemo(
    () => filterInitiatives(initiatives, ctx, filters),
    [initiatives, ctx, filters],
  )
  const featureCount = (id: string) => features.filter((f) => f.initiativeId === id).length

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Initiatives"
        description="The chunks of work you will do to move your objectives."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              open({
                kind: 'initiative',
                preset: {
                  objectiveId:
                    filters.objective && filters.objective !== NONE ? filters.objective : undefined,
                },
              })
            }
          >
            <Plus aria-hidden /> New initiative
          </Button>
        }
      />

      {initiatives.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No initiatives yet"
          description={
            objectives.length === 0
              ? 'An initiative is a chunk of work chosen to move an objective. You can add objectives first, or start with the work.'
              : 'An initiative is a chunk of work chosen to move one of your objectives.'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" onClick={() => open({ kind: 'initiative' })}>
                <Plus aria-hidden /> Add your first initiative
              </Button>
              {objectives.length === 0 && (
                <Button asChild variant="link">
                  <Link to="/app/workspace/objectives">Add an objective first</Link>
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          <FilterBar
            filters={filters}
            onChange={set}
            onClear={clear}
            noun="initiatives"
            shown={shown.length}
            total={initiatives.length}
            searchLabel="Search initiatives"
            statuses={WORK_STATUS_OPTIONS}
            sorts={SORT_OPTIONS}
            showPriority
            objectives={objectives}
            tags={tags}
          />
          {shown.length === 0 ? (
            <EmptyState
              title="No initiatives match"
              description="Try a different search, or clear the filters."
              action={
                <Button variant="outline" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <TableFrame>
              <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left text-body">
                <caption className="sr-only">Initiatives</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      Initiative
                    </th>
                    <th scope="col" className={cn(th, 'hidden md:table-cell')}>
                      Status
                    </th>
                    <th scope="col" className={cn(th, 'hidden md:table-cell')}>
                      Priority
                    </th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>
                      Impact
                    </th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>
                      Confidence
                    </th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>
                      Effort
                    </th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>
                      Owner
                    </th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>
                      Tags
                    </th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => {
                    const objective = objectives.find((o) => o.id === i.objectiveId)
                    const n = featureCount(i.id)
                    return (
                      <tr
                        key={i.id}
                        className="cursor-pointer transition-colors hover:bg-sand/60"
                        onClick={() => open({ kind: 'initiative', id: i.id })}
                      >
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => open({ kind: 'initiative', id: i.id })}
                            className="rounded-sm text-left text-title font-semibold break-words text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                          >
                            {i.title}
                          </button>
                          <p className="mt-0.5 text-caption text-muted-foreground">
                            {objective ? objective.title : 'No objective'} ·{' '}
                            <Link
                              to={`/app/workspace/features?initiative=${i.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
                            >
                              {pluralise(n, 'feature')}
                            </Link>
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
                            <StatusBadge status={i.status} />
                            {i.priority && <PriorityBadge priority={i.priority} />}
                          </div>
                        </td>
                        <td className={cn(td, 'hidden md:table-cell')}>
                          <StatusBadge status={i.status} />
                        </td>
                        <td className={cn(td, 'hidden md:table-cell')}>
                          <PriorityBadge priority={i.priority} />
                        </td>
                        <td className={cn(td, 'hidden lg:table-cell')}>
                          <LevelText level={i.scoring?.impact} />
                        </td>
                        <td className={cn(td, 'hidden lg:table-cell')}>
                          <ConfidenceBadge confidence={i.confidence} />
                        </td>
                        <td className={cn(td, 'hidden lg:table-cell')}>
                          <LevelText level={i.scoring?.effort} />
                        </td>
                        <td className={cn(td, 'hidden xl:table-cell')}>
                          {i.owner ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className={cn(td, 'hidden xl:table-cell')}>
                          <TagList ids={i.tagIds} tags={tags} />
                        </td>
                        <td
                          className={cn(td, 'hidden whitespace-nowrap tabular-nums xl:table-cell')}
                        >
                          {formatDate(i.updatedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableFrame>
          )}
        </>
      )}
    </div>
  )
}
