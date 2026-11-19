import { Plus, Puzzle } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { FilterBar } from './filter-bar'
import { PlanningGate } from './planning-gate'
import { NONE, SORT_OPTIONS, WORK_STATUS_OPTIONS, filterFeatures } from './query'
import { useFilters } from './use-filters'
import { PriorityBadge, Score, StatusBadge, TableFrame, TagList, td, th } from './work-table'

export function FeaturesPage() {
  usePageTitle('Features')
  return (
    <PlanningGate title="Features">
      <FeaturesContent />
    </PlanningGate>
  )
}

function dates(start?: string, end?: string) {
  if (start && end) return `${formatDate(start)} to ${formatDate(end)}`
  if (start) return `From ${formatDate(start)}`
  if (end) return `Until ${formatDate(end)}`
  return undefined
}

function FeaturesContent() {
  const { objectives, initiatives, features, tags } = usePlanningStore()
  const open = useItemDrawer((s) => s.open)
  const { filters: raw, set, clear } = useFilters()
  const filters = useMemo(
    () => ({
      ...raw,
      objective:
        raw.objective === NONE || objectives.some((o) => o.id === raw.objective)
          ? raw.objective
          : '',
      initiative:
        raw.initiative === NONE || initiatives.some((i) => i.id === raw.initiative)
          ? raw.initiative
          : '',
      tag: tags.some((t) => t.id === raw.tag) ? raw.tag : '',
    }),
    [raw, objectives, initiatives, tags],
  )
  const ctx = useMemo(() => ({ objectives, initiatives, tags }), [objectives, initiatives, tags])
  const shown = useMemo(() => filterFeatures(features, ctx, filters), [features, ctx, filters])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Features"
        description="The pieces that make each initiative real."
        actions={
          <Button
            variant="primary"
            onClick={() =>
              open({
                kind: 'feature',
                preset: {
                  initiativeId:
                    filters.initiative && filters.initiative !== NONE
                      ? filters.initiative
                      : undefined,
                },
              })
            }
          >
            <Plus aria-hidden /> New feature
          </Button>
        }
      />

      {features.length === 0 ? (
        <EmptyState
          icon={<Puzzle />}
          title="No features yet"
          description={
            initiatives.length === 0
              ? 'Features are the parts of an initiative you would build and ship. Add an initiative first, or add a feature on its own.'
              : 'Features are the parts of an initiative you would build and ship.'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" onClick={() => open({ kind: 'feature' })}>
                <Plus aria-hidden /> Add your first feature
              </Button>
              {initiatives.length === 0 && (
                <Button asChild variant="link">
                  <Link to="/app/workspace/initiatives">Add an initiative first</Link>
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
            noun="features"
            shown={shown.length}
            total={features.length}
            searchLabel="Search features"
            statuses={WORK_STATUS_OPTIONS}
            sorts={SORT_OPTIONS}
            showPriority
            objectives={objectives}
            initiatives={initiatives}
            tags={tags}
          />
          {shown.length === 0 ? (
            <EmptyState
              title="No features match"
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
                <caption className="sr-only">Features</caption>
                <thead>
                  <tr>
                    <th scope="col" className={th}>
                      Feature
                    </th>
                    <th scope="col" className={cn(th, 'hidden md:table-cell')}>
                      Status
                    </th>
                    <th scope="col" className={cn(th, 'hidden md:table-cell')}>
                      Priority
                    </th>
                    <th scope="col" className={cn(th, 'hidden text-right lg:table-cell')}>
                      Impact
                    </th>
                    <th scope="col" className={cn(th, 'hidden text-right lg:table-cell')}>
                      Effort
                    </th>
                    <th scope="col" className={cn(th, 'hidden lg:table-cell')}>
                      Tags
                    </th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>
                      Owner
                    </th>
                    <th scope="col" className={cn(th, 'hidden xl:table-cell')}>
                      Dates
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((f) => {
                    const parent = initiatives.find((i) => i.id === f.initiativeId)
                    return (
                      <tr
                        key={f.id}
                        className="cursor-pointer transition-colors hover:bg-sand/60"
                        onClick={() => open({ kind: 'feature', id: f.id })}
                      >
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => open({ kind: 'feature', id: f.id })}
                            className="rounded-sm text-left text-title font-semibold break-words text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                          >
                            {f.title}
                          </button>
                          <p className="mt-0.5 text-caption text-muted-foreground">
                            {parent ? parent.title : 'No initiative'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
                            <StatusBadge status={f.status} />
                            {f.priority && <PriorityBadge priority={f.priority} />}
                          </div>
                        </td>
                        <td className={cn(td, 'hidden md:table-cell')}>
                          <StatusBadge status={f.status} />
                        </td>
                        <td className={cn(td, 'hidden md:table-cell')}>
                          <PriorityBadge priority={f.priority} />
                        </td>
                        <td className={cn(td, 'hidden text-right lg:table-cell')}>
                          <Score value={f.scoring?.impact} />
                        </td>
                        <td className={cn(td, 'hidden text-right lg:table-cell')}>
                          <Score value={f.scoring?.effort} />
                        </td>
                        <td className={cn(td, 'hidden lg:table-cell')}>
                          <TagList ids={f.tagIds} tags={tags} />
                        </td>
                        <td className={cn(td, 'hidden xl:table-cell')}>
                          {f.owner ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td
                          className={cn(td, 'hidden whitespace-nowrap tabular-nums xl:table-cell')}
                        >
                          {dates(f.startDate, f.endDate) ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
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
