import { Archive, Layers, MoreHorizontal, Pencil, Plus, Target } from 'lucide-react'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { ShellContext } from '@/components/shell/app-shell'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/toast'
import { asPercent, objectiveProgress, type Product, type WorkStatus } from '@/domain'
import { PlanningGate } from '@/features/planning/planning-gate'
import { formatDate, formatRelativeTime, pluralise } from '@/lib/format'
import {
  CATEGORY_LABELS,
  HORIZON_LABELS,
  OBJECTIVE_STATUS_BADGE,
  OBJECTIVE_STATUS_LABELS,
  STATUS_LABELS,
} from '@/lib/labels'
import { toStorageError } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { useWorkspaceStore } from '@/store/workspace-store'

/** The product overview: what it is, where it is going, and what has been planned so far. */
export function WorkspacePage() {
  return (
    <StorageGate>
      <OverviewGate />
    </StorageGate>
  )
}

function OverviewGate() {
  const { products, activeProductId } = useWorkspaceStore()
  const product = products.find((p) => p.id === activeProductId)
  return (
    <PlanningGate title="Overview">{product ? <Overview product={product} /> : null}</PlanningGate>
  )
}

const OTHER: WorkStatus[] = ['paused', 'dropped']

function Overview({ product }: { product: Product }) {
  const { openEditProduct } = useOutletContext<ShellContext>()
  const archiveProduct = useWorkspaceStore((s) => s.archiveProduct)
  const updateProduct = useWorkspaceStore((s) => s.updateProduct)
  const open = useItemDrawer((s) => s.open)
  const openRoadmapForm = useItemDrawer((s) => s.openRoadmapForm)
  const { objectives, initiatives, features, roadmaps } = usePlanningStore()
  const [confirmArchive, setConfirmArchive] = useState(false)

  const strategy: [string, string | undefined][] = [
    ['What it is', product.description],
    ['Vision', product.vision],
    ['Who it is for', product.targetAudience],
  ]
  const hasStrategy = strategy.some(([, v]) => v)
  const facts = [
    product.category && CATEGORY_LABELS[product.category],
    product.planningHorizon && HORIZON_LABELS[product.planningHorizon],
  ].filter(Boolean)

  const countBy = (rows: { status: WorkStatus }[], s: WorkStatus) =>
    rows.filter((r) => r.status === s).length
  const columns: { label: string; of: (rows: { status: WorkStatus }[]) => number }[] = [
    ...(['idea', 'planned', 'in-progress', 'shipped'] as const).map((s) => ({
      label: STATUS_LABELS[s],
      of: (rows: { status: WorkStatus }[]) => countBy(rows, s),
    })),
    { label: 'Other', of: (rows) => rows.filter((r) => OTHER.includes(r.status)).length },
  ]

  return (
    <div className="flex flex-col gap-8">
      {product.sampleData && (
        <Alert
          tone="info"
          title={
            product.templateName
              ? `Started from the “${product.templateName}” template`
              : 'Started from a template'
          }
          action={
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-center"
              onClick={() =>
                void updateProduct(product.id, {
                  sampleData: undefined,
                  templateName: undefined,
                }).then(
                  () => toast.success('Marked as your own', 'The sample label is gone.'),
                  (e) => toast.error('Could not save', toStorageError(e).message),
                )
              }
            >
              These are mine now
            </Button>
          }
        >
          The objectives, initiatives and features here are sample data that show the shape of a
          plan. Edit them, delete them or replace them with your own, then dismiss this note.
        </Alert>
      )}
      <PageHeader
        title={product.name}
        description={product.tagline}
        meta={
          <>
            {facts.map((f) => (
              <span key={String(f)}>{f} · </span>
            ))}
            Created {formatDate(product.createdAt)} · Updated{' '}
            <span className="tabular-nums">{formatRelativeTime(product.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => openEditProduct()}>
              <Pencil aria-hidden /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem destructive onSelect={() => setConfirmArchive(true)}>
                  <Archive aria-hidden /> Archive product
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Two columns from `xl`: the plan itself on the left, the product's context on the right. Below `xl` the
          wrappers vanish and the sections stack in this order: strategy, objectives, work, roadmaps. */}
      <div className="flex flex-col gap-10 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] xl:items-start xl:gap-x-12">
        <div className="flex flex-col gap-10 max-xl:contents xl:col-start-2 xl:row-start-1 xl:gap-6 xl:rounded-card xl:border xl:bg-surface xl:p-7">
          <section aria-labelledby="strategy-heading" className="max-xl:order-1">
            <h2 id="strategy-heading" className="text-xl">
              Strategy
            </h2>
            {hasStrategy ? (
              <dl className="mt-4 flex flex-col gap-5 xl:gap-6">
                {strategy.map(([label, value]) =>
                  value ? (
                    <div key={label}>
                      <dt className="text-body font-semibold text-foreground">{label}</dt>
                      <dd className="mt-1 text-[0.9375rem] leading-7 whitespace-pre-line">
                        {value}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            ) : (
              <p className="mt-2 text-body text-muted-foreground">
                Nothing written yet. Add a description, vision and audience when you are ready.{' '}
                <button
                  type="button"
                  onClick={() => openEditProduct()}
                  className="rounded-sm font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
                >
                  Edit product
                </button>
              </p>
            )}
          </section>

          <section
            aria-labelledby="roadmaps-heading"
            className="max-xl:order-4 xl:border-t xl:pt-6"
          >
            <h2 id="roadmaps-heading" className="text-xl">
              Roadmaps{' '}
              <span className="font-sans text-body font-normal text-muted-foreground tabular-nums">
                {roadmaps.length}
              </span>
            </h2>
            {roadmaps.length === 0 ? (
              <EmptyState
                className="mt-4 bg-card"
                icon={<Layers />}
                title="No roadmap yet"
                description="A roadmap picks items from your plan and shows them now, next, later; on a timeline; and on a board."
                action={
                  <Button variant="outline" onClick={() => openRoadmapForm()}>
                    <Plus aria-hidden /> Create a roadmap
                  </Button>
                }
              />
            ) : (
              <ul className="mt-4 divide-y border-y bg-transparent">
                {roadmaps.map((r) => (
                  <li key={r.id} className="py-3">
                    <Link
                      to={`/app/roadmaps/${r.id}`}
                      className="rounded-sm text-title font-semibold text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                    >
                      {r.name}
                    </Link>
                    <span className="mt-0.5 block text-caption text-muted-foreground tabular-nums">
                      {pluralise(r.entries.length, 'item')} · Updated {formatDate(r.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-10 max-xl:contents xl:col-start-1 xl:row-start-1">
          <section aria-labelledby="objectives-heading" className="max-xl:order-2">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="objectives-heading" className="text-xl">
                Objectives{' '}
                <span className="font-sans text-body font-normal text-muted-foreground tabular-nums">
                  {objectives.length}
                </span>
              </h2>
              {objectives.length > 0 && (
                <Link
                  to="/app/workspace/objectives"
                  className="text-body font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
                >
                  Manage objectives
                </Link>
              )}
            </div>
            {objectives.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={<Target />}
                title="Start with an objective"
                description="The outcome you want. Initiatives and features will hang off it."
                action={
                  <Button variant="outline" onClick={() => open({ kind: 'objective' })}>
                    <Plus aria-hidden /> Add an objective
                  </Button>
                }
              />
            ) : (
              <ul className="mt-4 divide-y border-y">
                {objectives.slice(0, 5).map((o) => {
                  const p = objectiveProgress(o)
                  const n = initiatives.filter((i) => i.objectiveId === o.id).length
                  return (
                    <li
                      key={o.id}
                      className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => open({ kind: 'objective', id: o.id })}
                          className="rounded-sm text-left text-title font-semibold break-words text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                        >
                          {o.title}
                        </button>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                          <Badge variant={OBJECTIVE_STATUS_BADGE[o.status]}>
                            {OBJECTIVE_STATUS_LABELS[o.status]}
                          </Badge>
                          <span className="tabular-nums">{pluralise(n, 'initiative')}</span>
                        </p>
                      </div>
                      {p !== undefined && (
                        <div className="flex shrink-0 items-center gap-2 sm:w-56">
                          <Progress value={asPercent(p)} label={`Progress for ${o.title}`} />
                          <span className="w-10 text-right text-caption font-semibold text-foreground tabular-nums">
                            {asPercent(p)}%
                          </span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {objectives.length > 5 && (
              <p className="mt-2 text-caption text-muted-foreground">
                Showing 5 of {objectives.length}.
              </p>
            )}
          </section>

          <section aria-labelledby="work-heading" className="max-xl:order-3">
            <h2 id="work-heading" className="text-xl">
              Initiatives and features
            </h2>
            <p className="mt-1 text-body text-muted-foreground">
              How much is planned, and where it stands.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-left text-body">
                <caption className="sr-only">Initiatives and features by status</caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="border-b px-3 py-2.5 text-label font-semibold text-muted-foreground"
                    >
                      Kind
                    </th>
                    <th
                      scope="col"
                      className="border-b px-3 py-2.5 text-right text-label font-semibold text-muted-foreground"
                    >
                      Total
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c.label}
                        scope="col"
                        className="hidden border-b px-3 py-2.5 text-right text-label font-semibold text-muted-foreground sm:table-cell"
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Initiatives', initiatives, '/app/workspace/initiatives'],
                      ['Features', features, '/app/workspace/features'],
                    ] as const
                  ).map(([label, rows, to]) => (
                    <tr key={label}>
                      <th scope="row" className="border-b px-3 py-3 font-medium text-foreground">
                        <Link
                          to={to}
                          className="underline-offset-4 hover:text-primary-text hover:underline"
                        >
                          {label}
                        </Link>
                      </th>
                      <td className="border-b px-3 py-3 text-right font-semibold text-foreground tabular-nums">
                        {rows.length}
                      </td>
                      {columns.map((c) => (
                        <td
                          key={c.label}
                          className="hidden border-b px-3 py-3 text-right tabular-nums sm:table-cell"
                        >
                          {c.of(rows)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {initiatives.length === 0 && features.length === 0 && (
              <p className="mt-3 text-body text-muted-foreground">
                Nothing planned yet.{' '}
                <button
                  type="button"
                  onClick={() => open({ kind: 'initiative' })}
                  className="rounded-sm font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
                >
                  Add an initiative
                </button>{' '}
                to begin.
              </p>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${product.name}?`}
        description="It leaves your product list but nothing is deleted, including its objectives, initiatives and features. You can restore it any time from Data and backup."
        confirmLabel="Archive product"
        destructive
        onConfirm={async () => {
          try {
            await archiveProduct(product.id)
            toast.success('Product archived', product.name)
          } catch (e) {
            toast.error('Could not archive', toStorageError(e).message)
            throw e
          }
        }}
      />
    </div>
  )
}
