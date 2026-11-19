import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LANES,
  WORK_STATUSES,
  type Draft,
  type Initiative,
  type ProductBundle,
  type WorkStatus,
} from '@/domain'
import { formatDate, monthShort, pluralise } from '@/lib/format'
import { ConfidenceBadge, PriorityBadge } from '@/components/domain/indicators'
import { LANE_LABELS, LEVEL_LABELS, STATUS_BADGE, STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

/**
 * Read-only renderings of one ProductBundle in three layouts. All three read the same records:
 * the roadmap's entries point at initiatives, so nothing is copied between views.
 * Nothing here writes anywhere; it is safe to show a template or a saved product.
 */
type Layout = 'now-next-later' | 'timeline' | 'board'
type Item = {
  initiative: Draft<Initiative>
  lane?: (typeof LANES)[number]
  start?: string
  end?: string
}

function useItems(bundle: ProductBundle) {
  return useMemo(() => {
    const byId = new Map(bundle.initiatives.map((i) => [i.id, i]))
    const items: Item[] = bundle.roadmap.entries
      .filter((e) => e.itemType === 'initiative')
      .sort((a, b) => a.order - b.order)
      .flatMap((e) => {
        const initiative = byId.get(e.itemId)
        return initiative ? [{ initiative, lane: e.lane, start: e.startDate, end: e.endDate }] : []
      })
    const objectiveTitle = new Map(bundle.objectives.map((o) => [o.id, o.title]))
    const featureCount = new Map<string, number>()
    for (const f of bundle.features)
      if (f.initiativeId)
        featureCount.set(f.initiativeId, (featureCount.get(f.initiativeId) ?? 0) + 1)
    return { items, objectiveTitle, featureCount }
  }, [bundle])
}

interface ViewProps {
  bundle: ProductBundle
  onSelect?: (initiativeId: string) => void
  compact?: boolean
  /** For previews placed in a half-width column. */
  narrow?: boolean
}

function Title({
  item,
  onSelect,
  className,
}: {
  item: Item
  onSelect?: (id: string) => void
  className?: string
}) {
  const base = cn('text-left text-title font-semibold text-foreground', className)
  if (!onSelect) return <span className={base}>{item.initiative.title}</span>
  return (
    <button
      type="button"
      onClick={() => onSelect(item.initiative.id)}
      className={cn(
        base,
        'rounded-sm hover:text-primary-text hover:underline hover:underline-offset-4',
      )}
    >
      {item.initiative.title}
    </button>
  )
}

function NowNextLater({ bundle, onSelect, compact }: ViewProps) {
  const { items, objectiveTitle, featureCount } = useItems(bundle)
  return (
    <div className="grid gap-8 md:grid-cols-3 md:gap-10">
      {LANES.map((lane) => {
        const inLane = items.filter((i) => i.lane === lane)
        return (
          <section
            key={lane}
            aria-label={`${LANE_LABELS[lane]}, ${pluralise(inLane.length, 'initiative')}`}
          >
            <div className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
              <h3 className="text-title font-semibold text-foreground">{LANE_LABELS[lane]}</h3>
              <span className="text-caption text-muted-foreground tabular-nums">
                {inLane.length}
              </span>
            </div>
            <ul className="divide-y">
              {inLane.map((item) => (
                <li key={item.initiative.id} className="py-3.5">
                  <Title item={item} onSelect={onSelect} />
                  {!compact && item.initiative.description && (
                    <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">
                      {item.initiative.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant={STATUS_BADGE[item.initiative.status]}>
                      {STATUS_LABELS[item.initiative.status]}
                    </Badge>
                    <span className="text-label text-muted-foreground">
                      {item.initiative.objectiveId
                        ? objectiveTitle.get(item.initiative.objectiveId)
                        : null}
                    </span>
                  </div>
                  {!compact && (
                    <p className="mt-1.5 text-label text-muted-foreground tabular-nums">
                      {pluralise(featureCount.get(item.initiative.id) ?? 0, 'feature')}
                    </p>
                  )}
                </li>
              ))}
              {inLane.length === 0 && (
                <li className="py-3.5 text-caption text-muted-foreground">Nothing here yet.</li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

const BAR: Record<WorkStatus, string> = {
  'in-progress': 'bg-primary text-primary-foreground border-transparent',
  planned: 'bg-primary-soft text-primary-text border-primary-text/30',
  idea: 'bg-secondary text-ink border-border-strong',
  shipped: 'bg-success-soft text-success border-transparent',
  paused: 'bg-warning-soft text-warning border-transparent',
  dropped: 'bg-destructive-soft text-destructive border-transparent',
}

const monthIndex = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1

function Timeline({ bundle, onSelect, narrow }: ViewProps) {
  const { items } = useItems(bundle)
  const dated = items.filter((i) => i.start && i.end)
  const dates = [
    ...dated.flatMap((i) => [i.start!, i.end!]),
    ...bundle.milestones.map((m) => m.date),
  ]
  if (dates.length === 0)
    return <p className="text-body text-muted-foreground">No dates have been set yet.</p>
  const first = Math.min(...dates.map(monthIndex))
  const last = Math.max(...dates.map(monthIndex))
  const count = Math.max(last - first + 1, 3)
  const gridStyle = { gridTemplateColumns: `13rem repeat(${count}, minmax(4rem, 1fr))` }
  const months = Array.from({ length: count }, (_, i) => first + i)
  const milestones = [...bundle.milestones].sort((a, b) => a.date.localeCompare(b.date))

  const monthCells = (borderTop = false) =>
    months.map((m, i) => (
      <div
        key={m}
        aria-hidden
        className={cn('border-l', borderTop && 'border-t')}
        style={{ gridColumn: i + 2, gridRow: 1 }}
      />
    ))

  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Timeline, scroll sideways for more months"
    >
      <div className={narrow ? 'min-w-[34rem]' : 'min-w-[46rem]'}>
        <div className="grid border-b pb-2" style={gridStyle}>
          <div />
          {months.map((m) => (
            <div
              key={m}
              className="px-2 text-label font-semibold text-muted-foreground tabular-nums"
            >
              {monthShort(m)}
              {(m === first || m % 12 === 0) && (
                <span className="ml-1 font-normal">{Math.floor(m / 12)}</span>
              )}
            </div>
          ))}
        </div>
        {dated.map((item) => {
          const s = monthIndex(item.start!) - first
          const e = monthIndex(item.end!) - first
          const status = item.initiative.status
          return (
            <div
              key={item.initiative.id}
              className="grid items-center border-b"
              style={{ ...gridStyle, gridTemplateRows: '2.75rem' }}
            >
              <div
                className="relative z-10 min-w-0 truncate pr-3"
                style={{ gridColumn: 1, gridRow: 1 }}
              >
                <Title
                  item={item}
                  onSelect={onSelect}
                  className="block w-full truncate text-body"
                />
              </div>
              {monthCells()}
              <div
                className={cn(
                  'z-10 flex h-7 min-w-0 items-center rounded-full border px-3 text-label font-semibold',
                  BAR[status],
                )}
                style={{ gridColumn: `${s + 2} / ${e + 3}`, gridRow: 1 }}
                title={`${item.initiative.title}: ${formatDate(item.start!)} to ${formatDate(item.end!)}`}
              >
                <span className="truncate">{STATUS_LABELS[status]}</span>
              </div>
            </div>
          )
        })}
        {milestones.map((m) => (
          <div
            key={m.id}
            className="grid items-center border-b"
            style={{ ...gridStyle, gridTemplateRows: '2.5rem' }}
          >
            <p
              className="min-w-0 truncate pr-3 text-body text-muted-foreground"
              style={{ gridColumn: 1, gridRow: 1 }}
            >
              {m.title}
            </p>
            {monthCells()}
            <div
              className="z-10 flex items-center gap-2 px-2 whitespace-nowrap"
              style={{ gridColumn: `${monthIndex(m.date) - first + 2} / span 3`, gridRow: 1 }}
            >
              <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-primary-text" />
              <span className="text-label text-ink tabular-nums">
                Milestone, {formatDate(m.date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Board({ bundle, onSelect, compact, narrow }: ViewProps) {
  const { items, objectiveTitle, featureCount } = useItems(bundle)
  const statuses = WORK_STATUSES.filter(
    (s, i) => i < 4 || items.some((it) => it.initiative.status === s),
  )
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2',
        !narrow && (statuses.length > 4 ? 'xl:grid-cols-6' : 'lg:grid-cols-4'),
      )}
    >
      {statuses.map((status) => {
        const column = items.filter((i) => i.initiative.status === status)
        return (
          <section
            key={status}
            aria-label={`${STATUS_LABELS[status]}, ${pluralise(column.length, 'initiative')}`}
            className="rounded-card bg-surface p-3"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h3 className="text-body font-semibold text-foreground">{STATUS_LABELS[status]}</h3>
              <span className="text-caption text-muted-foreground tabular-nums">
                {column.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {column.map((item) => (
                <li key={item.initiative.id} className="rounded-input border bg-card p-3">
                  <Title item={item} onSelect={onSelect} className="text-body" />
                  {!compact && (
                    <p className="mt-1 text-label text-muted-foreground">
                      {item.initiative.objectiveId
                        ? objectiveTitle.get(item.initiative.objectiveId)
                        : null}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.lane && <Badge variant="outline">{LANE_LABELS[item.lane]}</Badge>}
                    <Badge variant="secondary" className="tabular-nums">
                      {pluralise(featureCount.get(item.initiative.id) ?? 0, 'feature')}
                    </Badge>
                  </div>
                </li>
              ))}
              {column.length === 0 && (
                <li className="px-1 py-2 text-caption text-muted-foreground">Empty</li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

const VIEWS: { value: Layout; label: string }[] = [
  { value: 'now-next-later', label: 'Now, next, later' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'board', label: 'Board' },
]

/** The three views over one roadmap, switchable. Pass `selectable` to open initiative details. */
export function RoadmapViewer({
  bundle,
  compact = false,
  selectable = false,
  defaultView = 'now-next-later',
}: {
  bundle: ProductBundle
  compact?: boolean
  selectable?: boolean
  defaultView?: Layout
}) {
  const [selected, setSelected] = useState<string>()
  const onSelect = selectable ? setSelected : undefined
  const props = { bundle, onSelect, compact }
  return (
    <>
      <Tabs defaultValue={defaultView}>
        <TabsList aria-label="Roadmap view">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value}>
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="now-next-later" className="mt-6">
          <NowNextLater {...props} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-6">
          <Timeline {...props} />
        </TabsContent>
        <TabsContent value="board" className="mt-6">
          <Board {...props} />
        </TabsContent>
      </Tabs>
      {selectable && (
        <InitiativeDrawer
          bundle={bundle}
          initiativeId={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-body text-ink">{label}</dt>
      <dd className="text-body font-semibold text-foreground">{children}</dd>
    </div>
  )
}

function InitiativeDrawer({
  bundle,
  initiativeId,
  onClose,
}: {
  bundle: ProductBundle
  initiativeId?: string
  onClose: () => void
}) {
  const initiative = bundle.initiatives.find((i) => i.id === initiativeId)
  const entry = bundle.roadmap.entries.find((e) => e.itemId === initiativeId)
  const objective = bundle.objectives.find((o) => o.id === initiative?.objectiveId)
  const features = bundle.features.filter((f) => f.initiativeId === initiativeId)
  const tags = bundle.tags.filter((t) => initiative?.tagIds.includes(t.id))
  const milestones = bundle.milestones.filter((m) => m.initiativeId === initiativeId)
  return (
    <Drawer open={Boolean(initiative)} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="xl">
        {initiative && (
          <>
            <DrawerHeader>
              <DrawerTitle>{initiative.title}</DrawerTitle>
              <DrawerDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE[initiative.status]}>
                    {STATUS_LABELS[initiative.status]}
                  </Badge>
                  {entry?.lane && <Badge variant="outline">{LANE_LABELS[entry.lane]}</Badge>}
                  <span className="text-caption text-muted-foreground">Sample, read-only</span>
                </div>
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-8">
              <section aria-labelledby="d-details">
                <h3 id="d-details" className="text-title font-semibold text-foreground">
                  Details
                </h3>
                <p className="mt-2 max-w-prose text-[0.9375rem] leading-7">
                  {initiative.description}
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {objective && (
                    <div>
                      <dt className="text-label font-semibold text-muted-foreground">Objective</dt>
                      <dd className="text-body text-foreground">{objective.title}</dd>
                    </div>
                  )}
                  {initiative.startDate && initiative.endDate && (
                    <div>
                      <dt className="text-label font-semibold text-muted-foreground">Planned</dt>
                      <dd className="text-body text-foreground tabular-nums">
                        {formatDate(initiative.startDate)} to {formatDate(initiative.endDate)}
                      </dd>
                    </div>
                  )}
                </dl>
                {tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
                    {tags.map((t) => (
                      <li key={t.id}>
                        <Badge variant="outline">{t.name}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section aria-labelledby="d-priority">
                <h3 id="d-priority" className="text-title font-semibold text-foreground">
                  Prioritisation
                </h3>
                <dl className="mt-2 max-w-md divide-y border-y">
                  <Row label="Impact">
                    {initiative.scoring?.impact
                      ? LEVEL_LABELS[initiative.scoring.impact]
                      : 'Not set'}
                  </Row>
                  <Row label="Effort">
                    {initiative.scoring?.effort
                      ? LEVEL_LABELS[initiative.scoring.effort]
                      : 'Not set'}
                  </Row>
                  <Row label="Confidence">
                    <ConfidenceBadge confidence={initiative.confidence} />
                  </Row>
                  <Row label="Priority">
                    <PriorityBadge priority={initiative.priority} />
                  </Row>
                </dl>
              </section>
              <section aria-labelledby="d-features">
                <h3 id="d-features" className="text-title font-semibold text-foreground">
                  Features{' '}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {features.length}
                  </span>
                </h3>
                <ul className="mt-2 divide-y border-y">
                  {features.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-body text-foreground">{f.title}</span>
                      <Badge variant={STATUS_BADGE[f.status]}>{STATUS_LABELS[f.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
              {milestones.length > 0 && (
                <section aria-labelledby="d-milestones">
                  <h3 id="d-milestones" className="text-title font-semibold text-foreground">
                    Milestones
                  </h3>
                  <ul className="mt-2 divide-y border-y">
                    {milestones.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-body text-foreground">{m.title}</span>
                        <span className="text-caption text-muted-foreground tabular-nums">
                          {formatDate(m.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

/** One layout, no switcher or interaction. For illustrating a view next to text that describes it. */
export function RoadmapLayout({
  bundle,
  layout,
  narrow = false,
}: {
  bundle: ProductBundle
  layout: Layout
  narrow?: boolean
}) {
  const props = { bundle, compact: true, narrow }
  if (layout === 'timeline') return <Timeline {...props} />
  if (layout === 'board') return <Board {...props} />
  return <NowNextLater {...props} />
}
