import { StatusBadge } from '@/components/domain/indicators'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Link2,
  Plus,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Milestone } from '@/domain'
import { TONE_BAR } from '@/lib/appearance'
import { useAppearanceStore } from '@/store/appearance-store'
import { formatDate } from '@/lib/format'
import { LANE_LABELS, STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useBindings } from './bindings'
import {
  monthEnd,
  monthName,
  monthStart,
  resizeRange,
  shiftRange,
  today,
  yearOf,
  type DayRange,
} from './dates'
import {
  NAV_MONTHS,
  ZOOMS,
  effectiveLane,
  headerSegments,
  initialAnchor,
  percentOf,
  pixelsToDays,
  rangeOf,
  rowKey,
  sortedMilestones,
  spanOf,
  swimlanes,
  timelineWindow,
  visibleLinks,
  type RoadmapRow,
  type Zoom,
} from './engine'
import type { useRoadmapData } from './use-roadmap'

type Data = ReturnType<typeof useRoadmapData>

const LANE_H = 44
const FEATURE_H = 36
const MILESTONE_H = 40
const HEADER_H = 52

type Meta =
  | {
      type: 'lane'
      id: string
      height: number
      title: string
      featureCount: number
      own?: RoadmapRow
      open: boolean
    }
  | { type: 'feature'; id: string; height: number; row: RoadmapRow }
  | { type: 'milestones'; id: string; height: number }

/**
 * The timeline. One swimlane per initiative, with its features tucked underneath (collapsed until you open
 * them, to keep it calm). Bars drag to move and resize at their ends, or move with the arrow keys. Dates belong to
 * the item, so a change here shows up on the board, in now/next/later and in the item's own form.
 */
export function TimelineView({ data }: { data: Data }) {
  const { roadmap, filtered, initiatives, milestones, dependencies, views } = data
  const view = views.find((v) => v.layout === 'timeline')
  const config = view?.config ?? {}
  const { saveViewConfig, updateItem, openItem: openRoadmapItem, openMilestone } = useBindings()
  const now = today()

  const [zoom, setZoomState] = useState<Zoom>(config.zoom ?? 'month')
  const [showLinks, setShowLinksState] = useState(config.showDependencies ?? true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [live, setLive] = useState('')
  const trackRef = useRef<HTMLDivElement>(null)

  const dated = useMemo(() => filtered.filter((r) => rangeOf(r.item)), [filtered])
  const undated = useMemo(() => filtered.filter((r) => !rangeOf(r.item)), [filtered])
  const [anchor, setAnchor] = useState(() =>
    initialAnchor(
      now,
      dated.map((r) => rangeOf(r.item)!),
    ),
  )
  const win = useMemo(() => timelineWindow(anchor, zoom), [anchor, zoom])
  const segments = useMemo(() => headerSegments(win, zoom), [win, zoom])

  const lanes = useMemo(() => swimlanes(filtered, initiatives), [filtered, initiatives])
  const showMilestones = (roadmap!.itemTypes ?? ['milestone']).includes('milestone')
  const visibleMilestones = useMemo(() => sortedMilestones(milestones), [milestones])

  const setZoom = (z: Zoom) => {
    setZoomState(z)
    if (view) void saveViewConfig(view.id, { ...config, zoom: z })
  }
  const setShowLinks = (on: boolean) => {
    setShowLinksState(on)
    if (view) void saveViewConfig(view.id, { ...config, showDependencies: on })
  }

  // Rows, top to bottom. The labels on the left and the tracks on the right are both drawn from this list so they stay aligned.
  const metas: Meta[] = []
  if (showMilestones) metas.push({ type: 'milestones', id: 'milestones', height: MILESTONE_H })
  for (const lane of lanes) {
    const open = expanded.has(lane.id)
    metas.push({
      type: 'lane',
      id: lane.id,
      height: LANE_H,
      title: lane.title,
      featureCount: lane.features.length,
      own: lane.own,
      open,
    })
    if (open)
      for (const f of lane.features.filter((r) => rangeOf(r.item)))
        metas.push({ type: 'feature', id: f.key, height: FEATURE_H, row: f })
  }
  const tops: number[] = []
  let total = 0
  for (const m of metas) {
    tops.push(total)
    total += m.height
  }

  // Where each drawn bar sits, for the dependency lines.
  const placed = new Map<string, { y: number; left: number; right: number }>()
  metas.forEach((m, i) => {
    const row = m.type === 'lane' ? m.own : m.type === 'feature' ? m.row : undefined
    const range = row && rangeOf(row.item)
    if (!row || !range) return
    const s = spanOf(range, win)
    if (s.visible)
      placed.set(row.key, { y: tops[i]! + m.height / 2, left: s.left, right: s.left + s.width })
  })
  const links = showLinks ? visibleLinks(dependencies, new Set(filtered.map((r) => r.key))) : []
  const drawn = links.flatMap((d) => {
    const a = placed.get(rowKey(d.fromType, d.fromId))
    const b = placed.get(rowKey(d.toType, d.toId))
    return a && b ? [{ d, a, b }] : []
  })

  const label = `${monthName(win.start)} ${yearOf(win.start)} to ${monthName(win.end)} ${yearOf(win.end)}`
  const step = NAV_MONTHS[zoom]
  const unitName = zoom
  const allOpen = lanes.every((l) => l.features.length === 0 || expanded.has(l.id))
  const hasFeatures = lanes.some((l) => l.features.length > 0)

  const commitRange = (row: RoadmapRow, range: DayRange) => {
    void updateItem(
      row,
      { startDate: range.start, endDate: range.end },
      `Moved “${row.item.title}” to ${formatDate(range.start)} – ${formatDate(range.end)}`,
    )
    setLive(`${row.item.title} now runs ${formatDate(range.start)} to ${formatDate(range.end)}.`)
  }

  const todayPct = percentOf(now, win)
  const showToday = todayPct >= 0 && todayPct <= 100

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div data-export-hide className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setAnchor(monthStart(anchor, -step))}
            aria-label={`Previous ${unitName}`}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(monthStart(now, -1))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setAnchor(monthStart(anchor, step))}
            aria-label={`Next ${unitName}`}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <p
          className="min-w-40 text-body font-semibold text-foreground tabular-nums"
          aria-live="polite"
        >
          {label}
        </p>
        <div
          role="group"
          aria-label="Timeline zoom"
          data-export-hide
          className="flex items-center gap-0.5 rounded-full bg-surface p-0.5"
        >
          {ZOOMS.map((z) => (
            <button
              key={z.value}
              type="button"
              aria-pressed={zoom === z.value}
              onClick={() => setZoom(z.value)}
              className={cn(
                'h-8 rounded-full px-3 text-body font-medium transition-colors',
                zoom === z.value
                  ? 'bg-primary-soft font-semibold text-primary-text'
                  : 'text-muted-foreground hover:bg-sand hover:text-foreground',
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
        <div data-export-hide className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {hasFeatures && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(allOpen ? new Set() : new Set(lanes.map((l) => l.id)))}
            >
              {allOpen ? <ChevronsDownUp aria-hidden /> : <ChevronsUpDown aria-hidden />}{' '}
              {allOpen ? 'Collapse features' : 'Show all features'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            aria-pressed={showLinks}
            onClick={() => setShowLinks(!showLinks)}
          >
            <Link2 aria-hidden /> Dependencies {showLinks ? 'on' : 'off'}
          </Button>
          {openMilestone && (
            <Button variant="outline" size="sm" onClick={() => openMilestone(undefined, now)}>
              <Plus aria-hidden /> Milestone
            </Button>
          )}
        </div>
      </div>

      <p role="status" className="sr-only">
        {live}
      </p>

      {lanes.length === 0 && !showMilestones ? null : (
        <div
          className="overflow-x-auto rounded-card border"
          role="region"
          aria-label="Timeline. Scroll sideways to see more months."
          tabIndex={0}
        >
          <div className="flex min-w-[56rem]">
            <div className="sticky left-0 z-20 w-56 shrink-0 border-r bg-background">
              <div className="border-b" style={{ height: HEADER_H }} />
              {metas.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center border-b px-3"
                  style={{ height: m.height }}
                >
                  {m.type === 'milestones' && (
                    <span className="text-body font-semibold text-muted-foreground">
                      Milestones
                    </span>
                  )}
                  {m.type === 'lane' && (
                    <div className="flex min-w-0 items-center gap-1">
                      {m.featureCount > 0 ? (
                        <button
                          type="button"
                          aria-expanded={m.open}
                          aria-label={`${m.open ? 'Hide' : 'Show'} ${m.featureCount} ${m.featureCount === 1 ? 'feature' : 'features'} of ${m.title}`}
                          onClick={() =>
                            setExpanded((s) => {
                              const n = new Set(s)
                              if (n.has(m.id)) n.delete(m.id)
                              else n.add(m.id)
                              return n
                            })
                          }
                          className="-ml-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-sand"
                        >
                          <ChevronDown
                            className={cn('size-4 transition-transform', !m.open && '-rotate-90')}
                            aria-hidden
                          />
                        </button>
                      ) : (
                        <span className="size-6 shrink-0" />
                      )}
                      <div className="min-w-0">
                        {m.own ? (
                          <button
                            type="button"
                            onClick={() =>
                              openRoadmapItem(roadmap!.id, 'initiative', m.own!.item.id)
                            }
                            className="block max-w-full truncate rounded-sm text-left text-body font-semibold text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                          >
                            {m.title}
                          </button>
                        ) : (
                          <span className="block truncate text-body font-semibold text-foreground">
                            {m.title}
                          </span>
                        )}
                        {m.featureCount > 0 && (
                          <span className="block text-label text-muted-foreground tabular-nums">
                            {m.featureCount} {m.featureCount === 1 ? 'feature' : 'features'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {m.type === 'feature' && (
                    <button
                      type="button"
                      onClick={() => openRoadmapItem(roadmap!.id, 'feature', m.row.item.id)}
                      className="ml-8 block max-w-full truncate rounded-sm text-left text-body text-ink hover:text-primary-text hover:underline hover:underline-offset-4"
                    >
                      {m.row.item.title}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div ref={trackRef} className="relative min-w-[40rem] flex-1">
              <div className="relative border-b" style={{ height: HEADER_H }}>
                {segments.map((s) => (
                  <div
                    key={s.left}
                    className="absolute inset-y-0 flex items-start border-l px-2 pt-2 text-label font-semibold whitespace-nowrap text-muted-foreground tabular-nums"
                    style={{ left: `${s.left}%`, width: `${s.width}%` }}
                  >
                    <span className="truncate">{s.label}</span>
                  </div>
                ))}
                {showToday && (
                  <span
                    className="absolute bottom-1 z-10 -translate-x-1/2 rounded-full bg-primary px-2 text-label leading-4 font-semibold text-primary-foreground"
                    style={{ left: `${todayPct}%` }}
                  >
                    Today
                  </span>
                )}
              </div>
              <div className="relative" style={{ height: total }}>
                {segments.map((s) => (
                  <div
                    key={s.left}
                    aria-hidden
                    className="absolute inset-y-0 border-l"
                    style={{ left: `${s.left}%` }}
                  />
                ))}
                {showToday && (
                  <div
                    aria-hidden
                    data-testid="today-line"
                    className="absolute inset-y-0 z-[5] w-0.5 -translate-x-1/2 bg-primary"
                    style={{ left: `${todayPct}%` }}
                  />
                )}

                {metas.map((m, i) => (
                  <div
                    key={m.id}
                    className="absolute inset-x-0 border-b"
                    style={{ top: tops[i], height: m.height }}
                  >
                    {m.type === 'milestones' && (
                      <MilestoneRow
                        milestones={visibleMilestones}
                        win={win}
                        onOpen={openMilestone ? (id) => openMilestone(id) : undefined}
                      />
                    )}
                    {m.type === 'lane' && m.own && rangeOf(m.own.item) && (
                      <Bar
                        row={m.own}
                        range={rangeOf(m.own.item)!}
                        win={win}
                        zoom={zoom}
                        trackRef={trackRef}
                        height={28}
                        onCommit={(r) => commitRange(m.own!, r)}
                        onOpen={() => openRoadmapItem(roadmap!.id, 'initiative', m.own!.item.id)}
                      />
                    )}
                    {m.type === 'lane' && !(m.own && rangeOf(m.own.item)) && (
                      <span className="absolute inset-y-0 left-3 flex items-center text-caption text-muted-foreground">
                        {m.own
                          ? 'No dates. See the list below.'
                          : 'Features only. Open to see them.'}
                      </span>
                    )}
                    {m.type === 'feature' && rangeOf(m.row.item) && (
                      <Bar
                        row={m.row}
                        range={rangeOf(m.row.item)!}
                        win={win}
                        zoom={zoom}
                        trackRef={trackRef}
                        height={22}
                        thin
                        onCommit={(r) => commitRange(m.row, r)}
                        onOpen={() => openRoadmapItem(roadmap!.id, 'feature', m.row.item.id)}
                      />
                    )}
                  </div>
                ))}

                {drawn.length > 0 && (
                  <svg
                    aria-hidden
                    data-testid="dependency-lines"
                    className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
                  >
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                      </marker>
                    </defs>
                    {drawn.map(({ d, a, b }) => {
                      const conflict = b.left < a.right // starts before what it waits for finishes
                      const mid = conflict ? a.right + 1.2 : a.right + (b.left - a.right) / 2
                      const cls = conflict
                        ? 'text-destructive'
                        : d.kind === 'blocks'
                          ? 'text-ink'
                          : 'text-muted-foreground'
                      const dash = d.kind === 'relates' ? '4 3' : undefined
                      const into = conflict ? b.left - 1.2 : b.left
                      return (
                        <g
                          key={d.id}
                          className={cls}
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="none"
                          strokeDasharray={dash}
                        >
                          <line x1={`${a.right}%`} y1={a.y} x2={`${mid}%`} y2={a.y} />
                          <line x1={`${mid}%`} y1={a.y} x2={`${mid}%`} y2={b.y} />
                          <line
                            x1={`${conflict ? into : mid}%`}
                            y1={b.y}
                            x2={`${b.left}%`}
                            y2={b.y}
                            markerEnd="url(#arrow)"
                          />
                        </g>
                      )
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {drawn.some(({ a, b }) => b.left < a.right) && (
        <p className="text-caption text-destructive">
          A red line means something is scheduled to start before what it depends on has finished.
        </p>
      )}

      {undated.length > 0 && (
        <section aria-labelledby="undated-heading" className="max-w-3xl">
          <h3 id="undated-heading" className="text-title font-semibold text-foreground">
            No dates{' '}
            <span className="font-normal text-muted-foreground tabular-nums">{undated.length}</span>
          </h3>
          <p className="mt-0.5 text-caption text-muted-foreground">
            These are on the roadmap but not on the timeline. Give one dates and it appears.
          </p>
          <ul className="mt-3 divide-y border-y">
            {undated.map((row) => {
              const lane = effectiveLane(row, roadmap!.planningMode, now)
              return (
                <li
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openRoadmapItem(roadmap!.id, row.kind, row.item.id)}
                      className="rounded-sm text-left text-body font-semibold text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                    >
                      {row.item.title}
                    </button>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={row.item.status} />
                      <span className="text-caption text-muted-foreground">
                        {row.kind === 'feature' ? 'Feature' : 'Initiative'}
                        {lane ? ` · ${LANE_LABELS[lane]}` : ''}
                      </span>
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => commitRange(row, { start: monthStart(now), end: monthEnd(now) })}
                    aria-label={`Schedule this month: ${row.item.title}`}
                  >
                    Schedule this month
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function MilestoneRow({
  milestones,
  win,
  onOpen,
}: {
  milestones: Milestone[]
  win: ReturnType<typeof timelineWindow>
  onOpen?: (id: string) => void
}) {
  // Show a label only when there is room, so nearby milestones do not print over each other.
  const inWindow = milestones
    .map((m) => ({ m, left: percentOf(m.date, win) }))
    .filter((x) => x.left >= 0 && x.left <= 100)
  const withLabel = inWindow.reduce<
    { m: Milestone; left: number; showLabel: boolean; nextFree: number }[]
  >((acc, x) => {
    const free = acc.length ? acc[acc.length - 1]!.nextFree : -Infinity
    const showLabel = x.left >= free
    return [...acc, { ...x, showLabel, nextFree: showLabel ? x.left + 12 : free }]
  }, [])
  return (
    <>
      {withLabel.map(({ m, left, showLabel }) => {
        const marker = (
          <>
            <span
              aria-hidden
              className={cn(
                'size-3 shrink-0 -translate-x-1/2 rotate-45',
                m.status === 'reached'
                  ? 'bg-success'
                  : m.status === 'missed'
                    ? 'bg-destructive'
                    : 'bg-primary-text',
              )}
            />
            {showLabel && (
              <span className="-ml-1 max-w-32 truncate text-label font-semibold text-foreground">
                {m.title}
              </span>
            )}
          </>
        )
        const common = {
          className: 'absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 rounded-sm',
          style: { left: `${left}%` },
          title: `${m.title}, ${formatDate(m.date)}`,
        }
        // In a preview there is nothing to open, so a milestone is only a marker.
        return onOpen ? (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpen(m.id)}
            aria-label={`Milestone: ${m.title}, ${formatDate(m.date)}. Open`}
            {...common}
          >
            {marker}
          </button>
        ) : (
          <span
            key={m.id}
            role="img"
            aria-label={`Milestone: ${m.title}, ${formatDate(m.date)}`}
            {...common}
          >
            {marker}
          </span>
        )
      })}
    </>
  )
}

interface BarProps {
  row: RoadmapRow
  range: DayRange
  win: ReturnType<typeof timelineWindow>
  zoom: Zoom
  trackRef: React.RefObject<HTMLDivElement | null>
  height: number
  thin?: boolean
  onCommit: (range: DayRange) => void
  onOpen: () => void
}

/** A bar you can drag to move, drag by its ends to resize, or move with the keyboard. */
function Bar({ row, range, win, zoom, trackRef, height, thin, onCommit, onOpen }: BarProps) {
  const [preview, setPreview] = useState<DayRange | null>(null)
  const drag = useRef<{
    mode: 'move' | 'start' | 'end'
    x0: number
    moved: boolean
    origin: DayRange
  } | null>(null)
  const shown = preview ?? range
  const span = spanOf(shown, win)
  const tone = useAppearanceStore((s) => s.statusTones[row.item.status])
  if (!span.visible) return <OutsideHint range={range} win={win} />

  const daysFor = (dx: number) =>
    pixelsToDays(dx, trackRef.current?.getBoundingClientRect().width ?? 0, win, zoom)
  const apply = (mode: 'move' | 'start' | 'end', days: number, origin: DayRange) =>
    mode === 'move' ? shiftRange(origin, days) : resizeRange(origin, mode, days)

  const down = (e: React.PointerEvent<HTMLElement>, mode: 'move' | 'start' | 'end') => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, x0: e.clientX, moved: false, origin: range }
  }
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0
    if (Math.abs(dx) > 3) d.moved = true
    if (d.moved) setPreview(apply(d.mode, daysFor(dx), d.origin))
  }
  const up = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (!d.moved) {
      setPreview(null)
      if (d.mode === 'move') onOpen() // a click, not a drag
      return
    }
    const final = apply(d.mode, daysFor(e.clientX - d.x0), d.origin)
    setPreview(null)
    if (final.start !== d.origin.start || final.end !== d.origin.end) onCommit(final)
  }
  const cancel = () => {
    drag.current = null
    setPreview(null)
  }

  const key = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault() // see RoadmapCard: the follow-up keypress would close the drawer that just opened
      return onOpen()
    }
    const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!dir) return
    e.preventDefault()
    const days = dir * 7
    onCommit(
      e.shiftKey
        ? resizeRange(range, 'end', days)
        : e.altKey
          ? resizeRange(range, 'start', days)
          : shiftRange(range, days),
    )
  }

  const describe = `${row.item.title}, ${STATUS_LABELS[row.item.status]}, ${formatDate(range.start)} to ${formatDate(range.end)}. Enter opens details. Arrow keys move it by a week, Shift with arrows changes the end, Alt with arrows changes the start.`

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={describe}
      data-testid={`bar-${row.key}`}
      onPointerDown={(e) => down(e, 'move')}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onKeyDown={key}
      title={preview ? `${formatDate(shown.start)} to ${formatDate(shown.end)}` : row.item.title}
      className={cn(
        'group absolute top-1/2 z-10 flex min-w-3 -translate-y-1/2 touch-none items-center overflow-hidden border px-3 text-label font-semibold select-none',
        TONE_BAR[tone][row.item.status === 'in-progress' ? 'solid' : 'soft'],
        span.clippedStart ? 'rounded-l-none border-l-0' : 'rounded-l-full',
        span.clippedEnd ? 'rounded-r-none border-r-0' : 'rounded-r-full',
        preview ? 'cursor-grabbing ring-2 ring-ring/50' : 'cursor-grab',
      )}
      style={{ left: `${span.left}%`, width: `${span.width}%`, height }}
    >
      {!span.clippedStart && (
        <span
          onPointerDown={(e) => down(e, 'start')}
          onPointerMove={move}
          onPointerUp={up}
          aria-hidden
          data-testid={`resize-start-${row.key}`}
          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize touch-none"
        />
      )}
      <span className="truncate">
        {preview
          ? `${formatDate(shown.start)} – ${formatDate(shown.end)}`
          : thin
            ? ''
            : STATUS_LABELS[row.item.status]}
      </span>
      {!span.clippedEnd && (
        <span
          onPointerDown={(e) => down(e, 'end')}
          onPointerMove={move}
          onPointerUp={up}
          aria-hidden
          data-testid={`resize-end-${row.key}`}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize touch-none"
        />
      )}
    </div>
  )
}

function OutsideHint({ range, win }: { range: DayRange; win: ReturnType<typeof timelineWindow> }) {
  const before = range.end < win.start
  return (
    <span
      className={cn(
        'absolute top-1/2 -translate-y-1/2 text-caption text-muted-foreground',
        before ? 'left-3' : 'right-3',
      )}
    >
      {before ? `Earlier: ${formatDate(range.start)}` : `Later: ${formatDate(range.start)}`}
    </span>
  )
}
