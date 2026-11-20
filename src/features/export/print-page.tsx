import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { StatusBadge } from '@/components/domain/indicators'
import { PriorityBadge } from '@/components/domain/indicators'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { PlanningGate } from '@/features/planning/planning-gate'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { today } from '@/features/roadmap/dates'
import {
  boardColumns,
  effectiveLane,
  rangeOf,
  spanOf,
  swimlanes,
  type RoadmapRow,
} from '@/features/roadmap/engine'
import { useRoadmapData } from '@/features/roadmap/use-roadmap'
import { TONE_BAR, TONE_EDGE, TONE_SWATCH } from '@/lib/appearance'
import { formatDate, pluralise } from '@/lib/format'
import { HORIZON_LABELS, LANE_LABELS, STATUS_LABELS } from '@/lib/labels'
import type { WorkStatus } from '@/domain'
import { cn } from '@/lib/utils'
import { useAppearanceStore } from '@/store/appearance-store'
import { usePlanningStore } from '@/store/planning-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import {
  FOOTER_HEIGHT,
  HEADER_HEIGHT,
  MARGIN,
  PAPER_OPTIONS,
  cssPageSize,
  fitWindow,
  geometry,
  paginate,
  type Orientation,
  type Paper,
} from './print-model'

type Layout = 'now-next-later' | 'timeline' | 'board'
const LAYOUTS: { value: Layout; label: string }[] = [
  { value: 'now-next-later', label: 'Now, next, later' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'board', label: 'Board by status' },
]
const isLayout = (v: string | null): v is Layout => LAYOUTS.some((l) => l.value === v)
const isPaper = (v: string | null): v is Paper => v === 'a4' || v === 'letter'

interface Block {
  key: string
  /** Stay on the same page as the block after this one (a heading, never alone at the foot of a page). */
  keep?: boolean
  node: React.ReactNode
}

export function RoadmapPrintPage() {
  const { roadmapId } = useParams()
  return (
    <PlanningGate title="Print">
      <PrintContent id={roadmapId} />
    </PlanningGate>
  )
}

function PrintContent({ id }: { id?: string }) {
  const data = useRoadmapData(id)
  const { roadmap, filtered, rows, filtering, initiatives, milestones, links } = data
  const [params, setParams] = useSearchParams()
  const product = useWorkspaceStore((s) => s.products.find((p) => p.id === s.activeProductId))
  const objectives = usePlanningStore((s) => s.objectives)
  const statusTones = useAppearanceStore((s) => s.statusTones)
  usePageTitle(roadmap ? `Print ${roadmap.name}` : 'Print')

  const requested = params.get('view')
  const layout: Layout = isLayout(requested)
    ? requested
    : (roadmap?.defaultView ?? 'now-next-later')
  const orientationParam = params.get('orientation')
  const orientation: Orientation =
    orientationParam === 'portrait' || orientationParam === 'landscape'
      ? orientationParam
      : layout === 'now-next-later'
        ? 'portrait'
        : 'landscape'
  const paperParam = params.get('paper')
  const paper: Paper = isPaper(paperParam) ? paperParam : 'a4'
  const geo = geometry(paper, orientation)
  const set = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(key, value)
        return next
      },
      { replace: true },
    )

  // A printed page is white on black ink, whatever the screen's theme is. Put the theme back on leaving.
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      if (wasDark) root.classList.add('dark')
    }
  }, [])

  const exported = useMemo(() => formatDate(new Date().toISOString()), [])
  const now = today()
  const cols = orientation === 'landscape' ? 3 : 2

  const objectiveOf = (r: RoadmapRow) =>
    r.kind === 'initiative'
      ? objectives.find((o) => o.id === (r.item as { objectiveId?: string }).objectiveId)?.title
      : undefined
  const parentOf = (r: RoadmapRow) =>
    r.kind === 'feature'
      ? initiatives.find((i) => i.id === (r.item as { initiativeId?: string }).initiativeId)?.title
      : undefined

  const card = (r: RoadmapRow) => {
    const range = rangeOf(r.item)
    const meta = [parentOf(r), objectiveOf(r), r.item.owner].filter(Boolean).join(' · ')
    const link = links.get(r.key)
    return (
      <div
        key={r.key}
        className={cn(
          'min-w-0 rounded-input border bg-card p-3',
          roadmap?.color && cn('border-l-4', TONE_EDGE[roadmap.color]),
        )}
      >
        <p className="text-label text-muted-foreground">
          {r.kind === 'feature' ? 'Feature' : 'Initiative'}
        </p>
        <p className="mt-0.5 text-body font-semibold break-words text-foreground">{r.item.title}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={r.item.status} />
          {r.item.priority && <PriorityBadge priority={r.item.priority} />}
          {link && link.blockedBy.some((b) => !b.done) && (
            <span className="text-caption text-muted-foreground">
              Blocked by{' '}
              {link.blockedBy
                .filter((b) => !b.done)
                .map((b) => b.title)
                .join(', ')}
            </span>
          )}
        </p>
        {meta && <p className="mt-2 text-caption break-words text-muted-foreground">{meta}</p>}
        <p className="mt-1 text-caption text-muted-foreground tabular-nums">
          {range ? `${formatDate(range.start)} to ${formatDate(range.end)}` : 'No dates'}
        </p>
      </div>
    )
  }

  /** Section heading, then the cards in rows of `cols`, so a page can break between rows. */
  const section = (key: string, title: string, items: RoadmapRow[]): Block[] => {
    if (items.length === 0) return []
    const out: Block[] = [
      {
        key: `${key}-h`,
        keep: true,
        node: (
          <h2 className="mt-2 border-b pb-1 font-sans text-title font-semibold text-foreground">
            {title} <span className="font-normal text-muted-foreground">{items.length}</span>
          </h2>
        ),
      },
    ]
    for (let i = 0; i < items.length; i += cols)
      out.push({
        key: `${key}-${i}`,
        node: (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {items.slice(i, i + cols).map(card)}
          </div>
        ),
      })
    return out
  }

  // The window a timeline is drawn over, and the month axis that repeats on every page.
  const dated = useMemo(
    () => filtered.flatMap((r) => (rangeOf(r.item) ? [{ r, range: rangeOf(r.item)! }] : [])),
    [filtered],
  )
  const win = useMemo(
    () =>
      fitWindow(
        dated.map((d) => d.range),
        now,
      ),
    [dated, now],
  )
  const LABEL_W = Math.round(geo.contentWidth * 0.26)
  const axis = (
    <div className="flex border-b bg-background text-label text-muted-foreground" aria-hidden>
      <div style={{ width: LABEL_W }} className="shrink-0 py-1 pr-2 font-semibold">
        Starts and ends
      </div>
      <div className="relative flex-1">
        <div className="flex">
          {win.months.map((m) => (
            <div
              key={m.start}
              style={{ width: `${(m.days / win.days) * 100}%` }}
              className="truncate border-l py-1 pl-1 tabular-nums"
            >
              {monthLabel(m.start, win.months.length)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const blocks: Block[] = useMemo(() => {
    const out: Block[] = []
    if (!roadmap) return out
    out.push({
      key: 'cover',
      node: (
        <div className="pb-2">
          <h1 className="flex items-center gap-3 text-headline leading-tight [overflow-wrap:anywhere]">
            {roadmap.color && (
              <span
                aria-hidden
                className={cn('size-3.5 shrink-0 rounded-full', TONE_SWATCH[roadmap.color])}
              />
            )}
            {roadmap.name}
          </h1>
          {roadmap.description && <p className="mt-2 text-title text-ink">{roadmap.description}</p>}
          <p className="mt-2 text-caption text-muted-foreground">
            {[
              roadmap.planningHorizon && HORIZON_LABELS[roadmap.planningHorizon],
              roadmap.planningMode === 'dates' ? 'Date-based' : 'Flexible',
              filtering
                ? `${filtered.length} of ${pluralise(rows.length, 'item')} (filtered)`
                : pluralise(filtered.length, 'item'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ),
    })
    if (layout === 'now-next-later') {
      for (const lane of ['now', 'next', 'later'] as const)
        out.push(
          ...section(
            lane,
            LANE_LABELS[lane],
            filtered.filter((r) => effectiveLane(r, roadmap.planningMode, now) === lane),
          ),
        )
      out.push(
        ...section(
          'none',
          'Not placed',
          filtered.filter((r) => !effectiveLane(r, roadmap.planningMode, now)),
        ),
      )
    } else if (layout === 'board') {
      for (const c of boardColumns(filtered, 'status', initiatives, 'manual'))
        out.push(...section(c.id, c.label, c.rows))
    } else {
      const undated = filtered.filter((r) => !rangeOf(r.item))
      const used = [...new Set(dated.map((d) => d.r.item.status))]
      out.push({
        key: 'legend',
        node: (
          <p className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            Bars:
            {used.map((st) => (
              <StatusBadge key={st} status={st} />
            ))}
          </p>
        ),
      })
      const ms = milestones.filter((m) => m.date >= win.start && m.date <= win.end)
      if (ms.length > 0)
        out.push({
          key: 'milestones',
          node: (
            <div className="flex items-start border-b py-1.5 text-caption">
              <div
                style={{ width: LABEL_W }}
                className="shrink-0 pr-2 font-semibold text-foreground"
              >
                Milestones
              </div>
              <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
                {ms.map((m) => (
                  <li key={m.id} className="text-muted-foreground tabular-nums">
                    <span aria-hidden>◆ </span>
                    <span className="font-semibold text-foreground">{m.title}</span>{' '}
                    {formatDate(m.date)}
                  </li>
                ))}
              </ul>
            </div>
          ),
        })
      const lanes = swimlanes(filtered, initiatives)
      for (const lane of lanes) {
        const laneRows = [...(lane.own ? [lane.own] : []), ...lane.features].filter((r) =>
          rangeOf(r.item),
        )
        if (laneRows.length === 0) continue
        // A lane that is only the initiative itself needs no heading above its single bar.
        if (lane.features.length > 0 || !lane.own)
          out.push({
            key: `l-${lane.id}`,
            keep: true,
            node: (
              <p className="border-b bg-sand px-2 py-1 text-label font-semibold text-foreground">
                {lane.title}
              </p>
            ),
          })
        for (const r of laneRows) {
          const range = rangeOf(r.item)!
          const span = spanOf(range, win)
          out.push({
            key: r.key,
            node: (
              <div className="flex items-center border-b py-1">
                <div
                  style={{ width: LABEL_W }}
                  className="shrink-0 pr-2 text-caption break-words text-foreground"
                >
                  {r.kind === 'feature' && <span className="text-muted-foreground">↳ </span>}
                  {r.item.title}
                </div>
                <div className="relative h-5 flex-1">
                  <div
                    className={cn(
                      'absolute top-0 flex h-5 items-center overflow-hidden border px-2 text-label font-semibold whitespace-nowrap',
                      TONE_BAR[statusTones[r.item.status]][
                        r.item.status === 'in-progress' ? 'solid' : 'soft'
                      ],
                      span.clippedStart ? 'rounded-l-none' : 'rounded-l-full',
                      span.clippedEnd ? 'rounded-r-none' : 'rounded-r-full',
                    )}
                    style={{ left: `${span.left}%`, width: `${Math.max(span.width, 0.8)}%` }}
                  >
                    {barText(span.width, geo.contentWidth - LABEL_W, range, r.item.status)}
                  </div>
                </div>
              </div>
            ),
          })
        }
      }
      out.push(...section('undated', 'Not scheduled', undated))
    }
    if (filtered.length === 0)
      out.push({
        key: 'empty',
        node: (
          <p className="text-body text-muted-foreground">Nothing to show with these filters.</p>
        ),
      })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    roadmap,
    filtered,
    rows.length,
    filtering,
    layout,
    orientation,
    paper,
    win,
    statusTones,
    links,
    initiatives,
    milestones,
    objectives,
  ])

  // Measure each block at the real content width, then split the blocks into pages.
  const measure = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<number[][]>([[]])
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    let cancelled = false
    const run = () => {
      const el = measure.current
      if (!el || cancelled) return
      const kids = [...el.querySelectorAll<HTMLElement>('[data-block]')]
      const heights = kids.map((k) => Math.ceil(k.getBoundingClientRect().height) + 10)
      const axisH =
        layout === 'timeline'
          ? Math.ceil(
              el.querySelector<HTMLElement>('[data-axis]')?.getBoundingClientRect().height ?? 0,
            )
          : 0
      setPages(
        paginate(
          heights,
          blocks.map((b) => Boolean(b.keep)),
          geo.contentHeight,
          axisH,
        ),
      )
      setReady(true)
    }
    run()
    // Fonts arrive after first paint and change every height, so measure again once they are in.
    void document.fonts?.ready.then(run)
    return () => {
      cancelled = true
    }
  }, [blocks, geo.contentHeight, geo.contentWidth, layout])

  if (!roadmap) {
    return (
      <p className="text-body text-muted-foreground">
        That roadmap does not exist.{' '}
        <Link to="/app/roadmaps" className="underline">
          All roadmaps
        </Link>
      </p>
    )
  }

  const total = pages.length
  const back = `/app/roadmaps/${roadmap.id}?${new URLSearchParams([...params].filter(([k]) => !['orientation', 'paper'].includes(k))).toString()}`

  return (
    <div className="flex flex-col gap-6">
      {/* The page size the browser prints to. It lives only while this page is open. */}
      <style>{`@page { size: ${cssPageSize(paper, orientation)}; margin: 0 }`}</style>

      <div className="flex flex-col gap-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to={back}>
              <ArrowLeft aria-hidden /> Back to the roadmap
            </Link>
          </Button>
          <Button variant="primary" onClick={() => window.print()} disabled={!ready}>
            <Printer aria-hidden /> Print or save as PDF
          </Button>
        </div>
        <div>
          <h1 className="text-headline leading-tight">Print preview</h1>
          <p className="mt-2 max-w-prose text-body text-muted-foreground">
            This is what each page will look like. Choose “Save as PDF” as the destination in the
            print window to get a file. Only what you see here is printed, and it follows the
            filters you had on the roadmap.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-label font-semibold text-foreground">
            Layout
            <Select value={layout} className="w-48" onChange={(e) => set('view', e.target.value)}>
              {LAYOUTS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-label font-semibold text-foreground">
            Orientation
            <Select
              value={orientation}
              className="w-36"
              onChange={(e) => set('orientation', e.target.value)}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-label font-semibold text-foreground">
            Paper
            <Select value={paper} className="w-32" onChange={(e) => set('paper', e.target.value)}>
              {PAPER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
          <p role="status" className="pb-2 text-body text-muted-foreground tabular-nums">
            {pluralise(total, 'page')}
          </p>
        </div>
        {layout === 'timeline' && orientation === 'portrait' && (
          <p className="text-caption text-muted-foreground">
            A timeline reads better in landscape.
          </p>
        )}
      </div>

      {/* Hidden copy used only to measure how tall each block is. */}
      <div
        ref={measure}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 -z-10 opacity-0 print:hidden"
        style={{ width: geo.contentWidth }}
      >
        {layout === 'timeline' && <div data-axis>{axis}</div>}
        {blocks.map((b) => (
          <div key={b.key} data-block>
            {b.node}
          </div>
        ))}
      </div>

      <div
        className="flex flex-col items-center gap-6 overflow-x-auto pb-8 print:block print:gap-0 print:overflow-visible print:pb-0"
        data-testid="print-pages"
      >
        {pages.map((indices, n) => (
          <section
            key={n}
            aria-label={`Page ${n + 1} of ${total}`}
            data-testid="print-sheet"
            className="print-sheet relative shrink-0 overflow-hidden bg-white text-[#1a1a1a] shadow-raised print:break-after-page print:shadow-none"
            style={{ width: geo.width, height: geo.height, padding: MARGIN }}
          >
            <header
              className="flex items-start justify-between gap-4 border-b border-black/15 pb-2 text-caption"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="font-semibold">{product?.name ?? 'Product'}</span>
              <span className="text-black/60">
                {roadmap.name} · Exported {exported}
              </span>
            </header>
            <div style={{ height: geo.contentHeight }} className="overflow-hidden">
              {/* The first page opens with the title block; the month axis follows it, and tops every later page. */}
              {layout === 'timeline' && n > 0 && axis}
              <div className="flex flex-col gap-2.5 pt-2.5">
                {indices.map((i) => (
                  <div key={blocks[i]!.key}>
                    {blocks[i]!.node}
                    {layout === 'timeline' && n === 0 && i === 0 && (
                      <div className="mt-2.5">{axis}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <footer
              className="absolute right-0 bottom-0 left-0 flex items-end justify-between text-caption text-black/60"
              style={{ height: FOOTER_HEIGHT + MARGIN, padding: `0 ${MARGIN}px ${MARGIN / 2}px` }}
            >
              <span>Made with Ordo</span>
              <span className="tabular-nums">
                Page {n + 1} of {total}
              </span>
            </footer>
          </section>
        ))}
      </div>
    </div>
  )
}

/** What fits inside a bar: its dates if there is room, else its status, else nothing. */
function barText(
  percent: number,
  trackPx: number,
  range: { start: string; end: string },
  status: WorkStatus,
) {
  const px = (percent / 100) * trackPx
  if (px > 200) return `${formatDate(range.start)} – ${formatDate(range.end)}`
  if (px > 90) return STATUS_LABELS[status]
  return ''
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(day: string, count: number) {
  const m = MONTHS[Number(day.slice(5, 7)) - 1]!
  const showYear = day.slice(5, 7) === '01' || count <= 6
  return showYear ? `${m} ${day.slice(0, 4)}` : m
}
