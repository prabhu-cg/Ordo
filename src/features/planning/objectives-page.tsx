import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import {
  OBJECTIVE_STATUSES,
  asPercent,
  objectiveProgress,
  outcomeProgress,
  type Objective,
} from '@/domain'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { formatDate, pluralise } from '@/lib/format'
import { OBJECTIVE_STATUS_BADGE, OBJECTIVE_STATUS_LABELS } from '@/lib/labels'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { FilterBar } from './filter-bar'
import { PlanningGate } from './planning-gate'
import { OBJECTIVE_SORT_OPTIONS, filterObjectives } from './query'
import { useFilters } from './use-filters'

export function ObjectivesPage() {
  usePageTitle('Objectives')
  return (
    <PlanningGate title="Objectives">
      <ObjectivesContent />
    </PlanningGate>
  )
}

const num = (n: number, unit?: string) =>
  `${Number.isInteger(n) ? n : Number(n.toFixed(2))}${unit ? ` ${unit}` : ''}`

function ObjectivesContent() {
  const { objectives, initiatives, features } = usePlanningStore()
  const open = useItemDrawer((s) => s.open)
  const { filters, set, clear } = useFilters()
  const shown = useMemo(() => filterObjectives(objectives, filters), [objectives, filters])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Objectives"
        description="The outcomes you want, and how you will know you got there."
        actions={
          <Button variant="primary" onClick={() => open({ kind: 'objective' })}>
            <Plus aria-hidden /> New objective
          </Button>
        }
      />

      {objectives.length === 0 ? (
        <EmptyState
          icon={<Target />}
          title="Start with an objective"
          description="An objective is an outcome you want, such as “find the first 25 people who care”. Initiatives and features hang off it."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" onClick={() => open({ kind: 'objective' })}>
                <Plus aria-hidden /> Add your first objective
              </Button>
              <Button asChild variant="link">
                <Link to="/app/onboarding?step=1">How objectives work</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <FilterBar
            filters={filters}
            onChange={set}
            onClear={clear}
            noun="objectives"
            shown={shown.length}
            total={objectives.length}
            searchLabel="Search objectives"
            statuses={OBJECTIVE_STATUSES.map((s) => ({
              value: s,
              label: OBJECTIVE_STATUS_LABELS[s],
            }))}
            sorts={OBJECTIVE_SORT_OPTIONS}
          />
          {shown.length === 0 ? (
            <EmptyState
              title="No objectives match"
              action={
                <Button variant="outline" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="border-b">
              {shown.map((o) => {
                const myInitiatives = initiatives.filter((i) => i.objectiveId === o.id)
                const myFeatures = features.filter((f) =>
                  myInitiatives.some((i) => i.id === f.initiativeId),
                )
                return (
                  <ObjectiveRow
                    key={o.id}
                    objective={o}
                    initiativeCount={myInitiatives.length}
                    featureCount={myFeatures.length}
                  />
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function ObjectiveRow({
  objective: o,
  initiativeCount,
  featureCount,
}: {
  objective: Objective
  initiativeCount: number
  featureCount: number
}) {
  const { open, askDelete } = useItemDrawer()
  const progress = objectiveProgress(o)
  const outcomes = o.outcomes ?? []
  return (
    <li className="border-t py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-sans text-title font-semibold break-words text-foreground">
              <button
                type="button"
                onClick={() => open({ kind: 'objective', id: o.id })}
                className="rounded-sm text-left hover:text-primary-text hover:underline hover:underline-offset-4"
              >
                {o.title}
              </button>
            </h2>
            <Badge variant={OBJECTIVE_STATUS_BADGE[o.status]}>
              {OBJECTIVE_STATUS_LABELS[o.status]}
            </Badge>
            {o.targetDate && <Badge variant="outline">Target {formatDate(o.targetDate)}</Badge>}
          </div>
          {o.description && (
            <p className="mt-1.5 max-w-prose text-body text-muted-foreground">{o.description}</p>
          )}
          <p className="mt-2 text-caption text-muted-foreground tabular-nums">
            <Link
              to={`/app/workspace/initiatives?objective=${o.id}`}
              className="font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
            >
              {pluralise(initiativeCount, 'initiative')}
            </Link>{' '}
            · {pluralise(featureCount, 'feature')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => open({ kind: 'objective', id: o.id })}
            aria-label={`Edit ${o.title}`}
          >
            <Pencil aria-hidden /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => open({ kind: 'initiative', preset: { objectiveId: o.id } })}
            aria-label={`Add initiative to ${o.title}`}
          >
            <Plus aria-hidden /> Add initiative
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => askDelete('objective', o.id)}
            aria-label={`Delete ${o.title}`}
          >
            <Trash2 aria-hidden /> Delete
          </Button>
        </div>
      </div>

      {outcomes.length > 0 ? (
        <div className="mt-5 max-w-3xl">
          <div className="mb-2 flex items-center gap-3">
            <Progress
              value={asPercent(progress ?? 0)}
              label={`Overall progress for ${o.title}`}
              className="max-w-xs"
            />
            <span className="text-caption font-semibold text-foreground tabular-nums">
              {asPercent(progress ?? 0)}% overall
            </span>
          </div>
          <table className="w-full border-separate border-spacing-0 text-left text-body">
            <caption className="sr-only">Outcomes for {o.title}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b py-2 pr-3 text-label font-semibold text-muted-foreground"
                >
                  Outcome
                </th>
                <th
                  scope="col"
                  className="hidden border-b px-3 py-2 text-right text-label font-semibold text-muted-foreground sm:table-cell"
                >
                  Baseline
                </th>
                <th
                  scope="col"
                  className="border-b px-3 py-2 text-right text-label font-semibold text-muted-foreground"
                >
                  Current
                </th>
                <th
                  scope="col"
                  className="border-b px-3 py-2 text-right text-label font-semibold text-muted-foreground"
                >
                  Target
                </th>
                <th
                  scope="col"
                  className="border-b py-2 pl-3 text-label font-semibold text-muted-foreground"
                >
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((x) => {
                const pct = asPercent(outcomeProgress(x))
                return (
                  <tr key={x.id}>
                    <th scope="row" className="border-b py-2.5 pr-3 font-medium text-foreground">
                      {x.title}
                      {x.metric && (
                        <span className="block text-caption font-normal text-muted-foreground">
                          {x.metric}
                        </span>
                      )}
                    </th>
                    <td className="hidden border-b px-3 py-2.5 text-right tabular-nums sm:table-cell">
                      {num(x.baseline, x.unit)}
                    </td>
                    <td className="border-b px-3 py-2.5 text-right text-foreground tabular-nums">
                      {num(x.current, x.unit)}
                    </td>
                    <td className="border-b px-3 py-2.5 text-right tabular-nums">
                      {num(x.target, x.unit)}
                    </td>
                    <td className="border-b py-2.5 pl-3">
                      <div className="flex min-w-24 items-center gap-2">
                        <Progress value={pct} label={`Progress for ${x.title}`} className="w-16" />
                        <span className="w-9 text-caption tabular-nums">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-caption text-muted-foreground">
          No measurable outcomes yet.{' '}
          <button
            type="button"
            onClick={() => open({ kind: 'objective', id: o.id })}
            className="rounded-sm font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
          >
            Add one
          </button>{' '}
          to track progress.
        </p>
      )}
    </li>
  )
}
