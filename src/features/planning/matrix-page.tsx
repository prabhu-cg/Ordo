import { splitHandle } from '@/features/roadmap/card-handle'
import { Info, MoreHorizontal, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfidenceBadge, LevelBadge, PriorityBadge } from '@/components/domain/indicators'
import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import {
  LEVELS,
  QUADRANT_INFO,
  placement,
  quadrantOf,
  type Feature,
  type Initiative,
  type Level,
  type Quadrant,
} from '@/domain'
import { DragBoard } from '@/features/roadmap/drag-board'
import { updateWork } from '@/features/roadmap/actions'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { LEVEL_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { PlanningGate } from './planning-gate'

type Kind = 'initiative' | 'feature'
type Item = { kind: Kind; item: Initiative | Feature; key: string }
const SHOW = [
  { value: 'both', label: 'Both' },
  { value: 'initiatives', label: 'Initiatives' },
  { value: 'features', label: 'Features' },
] as const

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const
const byPriority = (a: Item, b: Item) =>
  (a.item.priority ? PRIORITY_RANK[a.item.priority] : 9) -
    (b.item.priority ? PRIORITY_RANK[b.item.priority] : 9) ||
  a.item.title.localeCompare(b.item.title)

// Top row is high impact; left column is low effort. So quick wins sit top left.
const ORDER: Quadrant[] = ['quick-wins', 'major-projects', 'fill-ins', 'reconsider']

export function MatrixPage() {
  usePageTitle('Prioritise')
  return (
    <PlanningGate title="Prioritise">
      <MatrixContent />
    </PlanningGate>
  )
}

function MatrixContent() {
  const { initiatives, features } = usePlanningStore()
  const open = useItemDrawer((s) => s.open)
  const [params, setParams] = useSearchParams()
  const show = SHOW.some((s) => s.value === params.get('show')) ? params.get('show')! : 'both'
  const q = params.get('q') ?? ''
  const set = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase()
    const take = (kind: Kind, rows: (Initiative | Feature)[]): Item[] =>
      rows
        // Work that is finished or dropped is not being prioritised any more.
        .filter((r) => r.status !== 'shipped' && r.status !== 'dropped')
        .filter((r) => !needle || r.title.toLowerCase().includes(needle))
        .map((item) => ({ kind, item, key: `${kind}:${item.id}` }))
    return [
      ...(show !== 'features' ? take('initiative', initiatives) : []),
      ...(show !== 'initiatives' ? take('feature', features) : []),
    ]
  }, [initiatives, features, show, q])

  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items])
  const placed = (qd: Quadrant) =>
    items.filter((i) => placement(i.item)?.quadrant === qd).sort(byPriority)
  const unscored = items.filter((i) => !placement(i.item)).sort(byPriority)

  const setScore = (it: Item, field: 'impact' | 'effort', level: Level | undefined) => {
    // Start from the item as it is now, not as it was last drawn: two quick changes must not undo each other.
    const state = usePlanningStore.getState()
    const list: { id: string; scoring?: { impact?: Level; effort?: Level } }[] =
      it.kind === 'initiative' ? state.initiatives : state.features
    const latest = list.find((x) => x.id === it.item.id)
    const scoring = { ...(latest?.scoring ?? it.item.scoring), [field]: level }
    const empty = !scoring.impact && !scoring.effort
    // Changing a score gives the item a new place by its scores, so a hand-placement no longer applies.
    return updateWork(
      it.kind,
      latest ?? it.item,
      { scoring: empty ? undefined : scoring, matrixOverride: undefined },
      `${field === 'impact' ? 'Impact' : 'Effort'} of “${it.item.title}” set to ${level ? LEVEL_LABELS[level].toLowerCase() : 'not set'}`,
    )
  }

  const none = initiatives.length === 0 && features.length === 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Prioritise"
        description="Plot your work by how much it matters and how much effort it takes. The matrix is a guide: it never changes an item’s priority, and you can place any item by hand."
      />

      {none ? (
        <EmptyState
          title="Nothing to prioritise yet"
          description="Add initiatives or features first, then give them an impact and an effort."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div
              role="group"
              aria-label="Show"
              className="flex items-center gap-0.5 rounded-full bg-surface p-0.5"
            >
              {SHOW.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={show === s.value}
                  onClick={() => set('show', s.value === 'both' ? '' : s.value)}
                  className={cn(
                    'h-8 rounded-full px-3 text-body font-medium transition-colors',
                    show === s.value
                      ? 'bg-primary-soft font-semibold text-primary-text'
                      : 'text-muted-foreground hover:bg-sand hover:text-foreground',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Input
              type="search"
              aria-label="Search the matrix"
              placeholder="Search"
              value={q}
              onChange={(e) => set('q', e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <p role="status" className="text-caption text-muted-foreground tabular-nums sm:ml-auto">
              {items.length} {items.length === 1 ? 'item' : 'items'} · finished and dropped work is
              left out
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div
              className="flex items-center justify-between text-label font-semibold text-muted-foreground"
              aria-hidden
            >
              <span>↑ Higher impact</span>
              <span>Effort: lower ← → higher</span>
            </div>
            <DragBoard
              className="md:grid-cols-2"
              showInsertion={false}
              columns={ORDER.map((qd) => ({
                id: qd,
                label: QUADRANT_INFO[qd].label,
                keys: placed(qd).map((i) => i.key),
                emptyText: 'Nothing here. Drag an item in to place it.',
                header: (
                  <div className="px-1 pb-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="flex items-center gap-1.5 text-body font-semibold text-foreground">
                        {QUADRANT_INFO[qd].label}
                        <Tooltip content={QUADRANT_INFO[qd].rule}>
                          <button
                            type="button"
                            className="rounded-full text-muted-foreground hover:text-foreground"
                            aria-label={`How items land in ${QUADRANT_INFO[qd].label}`}
                          >
                            <Info className="size-3.5" aria-hidden />
                          </button>
                        </Tooltip>
                      </h3>
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {placed(qd).length}
                      </span>
                    </div>
                    <p className="text-caption text-muted-foreground">{QUADRANT_INFO[qd].blurb}</p>
                  </div>
                ),
              }))}
              describe={(key) => byKey.get(key)?.item.title ?? 'item'}
              onDrop={(key, _drop, columnId) => {
                const it = byKey.get(key)
                if (!it) return
                const target = columnId as Quadrant
                const computed = quadrantOf(it.item.scoring?.impact, it.item.scoring?.effort)
                const current = placement(it.item)?.quadrant
                if (current === target) return
                // Dropping where the scores already say clears the override; anywhere else records it.
                void updateWork(
                  it.kind,
                  it.item,
                  { matrixOverride: target === computed ? undefined : target },
                  `Placed “${it.item.title}” in ${QUADRANT_INFO[target].label}`,
                )
              }}
              renderCard={(key, state) => {
                const it = byKey.get(key)
                if (!it) return null
                const manual = Boolean(it.item.matrixOverride)
                const { ref, listeners, attributes } = splitHandle(
                  state.handleProps?.handleProps as Record<string, unknown> | undefined,
                )
                return (
                  <div
                    className={cn(
                      'relative rounded-input border bg-card',
                      !state.overlay && 'hover:border-border-strong',
                    )}
                  >
                    <div
                      {...listeners}
                      onClick={() => open({ kind: it.kind, id: it.item.id })}
                      onKeyDown={(e) => {
                        state.handleProps?.handleProps.onKeyDown?.(e)
                        if (
                          e.key === 'Enter' &&
                          (e.target as HTMLElement).getAttribute('role') === 'button'
                        ) {
                          e.preventDefault()
                          open({ kind: it.kind, id: it.item.id })
                        }
                      }}
                      className="block cursor-pointer rounded-input p-3 pr-10 text-left has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40"
                    >
                      <span className="text-label text-muted-foreground">
                        {it.kind === 'feature' ? 'Feature' : 'Initiative'}
                      </span>
                      <span
                        {...(state.overlay ? {} : { role: 'button', tabIndex: 0, ...attributes })}
                        ref={(node) => {
                          if (!state.overlay) ref?.(node)
                        }}
                        aria-label={state.overlay ? undefined : `${it.item.title}, ${it.kind}`}
                        className="mt-1 line-clamp-3 block text-body font-semibold break-words text-foreground outline-none"
                      >
                        {it.item.title}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <PriorityBadge
                          priority={it.item.priority}
                          className={it.item.priority ? '' : 'hidden'}
                        />
                        <LevelBadge
                          kind="Impact"
                          level={it.item.scoring?.impact}
                          className={it.item.scoring?.impact ? '' : 'hidden'}
                        />
                        <LevelBadge
                          kind="Effort"
                          level={it.item.scoring?.effort}
                          className={it.item.scoring?.effort ? '' : 'hidden'}
                        />
                        {it.item.confidence && (
                          <ConfidenceBadge confidence={it.item.confidence} focusable={false} />
                        )}
                        {manual && (
                          <Badge
                            variant="soft"
                            title="Placed by hand. Its scores would put it elsewhere."
                          >
                            Placed by hand
                          </Badge>
                        )}
                      </span>
                    </div>
                    {!state.overlay && <ScoreMenu it={it} manual={manual} setScore={setScore} />}
                  </div>
                )
              }}
            />
          </div>

          {unscored.length > 0 && (
            <section aria-labelledby="unscored-heading" className="max-w-4xl">
              <h2
                id="unscored-heading"
                className="font-sans text-title font-semibold text-foreground"
              >
                Not scored yet{' '}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {unscored.length}
                </span>
              </h2>
              <p className="mt-0.5 text-caption text-muted-foreground">
                Give each an impact and an effort and it appears on the matrix.
              </p>
              <ul className="mt-3 divide-y border-y">
                {unscored.map((it) => (
                  <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <button
                        type="button"
                        onClick={() => open({ kind: it.kind, id: it.item.id })}
                        className="rounded-sm text-left text-body font-semibold text-foreground hover:text-primary-text hover:underline hover:underline-offset-4"
                      >
                        {it.item.title}
                      </button>
                      <span className="block text-caption text-muted-foreground">
                        {it.kind === 'feature' ? 'Feature' : 'Initiative'}
                      </span>
                    </div>
                    {(['impact', 'effort'] as const).map((field) => (
                      <label
                        key={field}
                        className="flex items-center gap-2 text-caption text-muted-foreground"
                      >
                        {field === 'impact' ? 'Impact' : 'Effort'}
                        <Select
                          aria-label={`${field === 'impact' ? 'Impact' : 'Effort'} of ${it.item.title}`}
                          className="h-9 w-32"
                          value={it.item.scoring?.[field] ?? ''}
                          onChange={(e) =>
                            void setScore(
                              it,
                              field,
                              (e.target.value || undefined) as Level | undefined,
                            )
                          }
                        >
                          <option value="">Not set</option>
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {LEVEL_LABELS[l]}
                            </option>
                          ))}
                        </Select>
                      </label>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/** Change impact or effort, or hand the item back to its scores, without dragging: also the keyboard route. */
function ScoreMenu({
  it,
  manual,
  setScore,
}: {
  it: Item
  manual: boolean
  setScore: (it: Item, field: 'impact' | 'effort', level: Level | undefined) => unknown
}) {
  const open = useItemDrawer((s) => s.open)
  return (
    <div className="absolute top-1.5 right-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={`Score ${it.item.title}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => open({ kind: it.kind, id: it.item.id })}>
            Open details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(['impact', 'effort'] as const).map((field) => (
            <div key={field}>
              <DropdownMenuLabel>{field === 'impact' ? 'Impact' : 'Effort'}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={it.item.scoring?.[field] ?? 'none'}
                onValueChange={(v) =>
                  void setScore(it, field, v === 'none' ? undefined : (v as Level))
                }
              >
                {LEVELS.map((l) => (
                  <DropdownMenuRadioItem key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </DropdownMenuRadioItem>
                ))}
                <DropdownMenuRadioItem value="none">Not set</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </div>
          ))}
          {manual && (
            <DropdownMenuItem
              onSelect={() =>
                void updateWork(
                  it.kind,
                  it.item,
                  { matrixOverride: undefined },
                  `“${it.item.title}” is back where its scores put it`,
                )
              }
            >
              <RotateCcw aria-hidden /> Use its scores
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
