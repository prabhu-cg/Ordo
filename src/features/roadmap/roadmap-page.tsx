import {
  Layers,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Settings2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBar } from '@/features/planning/filter-bar'
import { PlanningGate } from '@/features/planning/planning-gate'
import { WORK_STATUS_OPTIONS } from '@/features/planning/query'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { HORIZON_LABELS } from '@/lib/labels'
import { pluralise } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useItemDrawer } from '@/store/drawer-store'
import { useUndoStore } from '@/store/undo-store'
import { deleteRoadmap, ensureViews, undoLatest } from './actions'
import { BoardView } from './board-view'
import { NowNextLaterView } from './nnl-view'
import { TimelineView } from './timeline-view'
import { useRoadmapData } from './use-roadmap'

type View = 'now-next-later' | 'timeline' | 'board'
const VIEWS: { value: View; label: string }[] = [
  { value: 'now-next-later', label: 'Now, next, later' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'board', label: 'Board' },
]
const isView = (v: string | null): v is View => VIEWS.some((x) => x.value === v)

export function RoadmapPage() {
  const { roadmapId } = useParams()
  return (
    <PlanningGate title="Roadmap">
      <RoadmapContent id={roadmapId} />
    </PlanningGate>
  )
}

function RoadmapContent({ id }: { id?: string }) {
  const data = useRoadmapData(id)
  const { roadmap, rows, filtered, filtering, filters, setFilter, clearFilters, initiatives } = data
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { openAddItems, openRoadmapForm, openSaveTemplate } = useItemDrawer()
  const lastUndo = useUndoStore((s) => s.stack.at(-1))
  const [confirmDelete, setConfirmDelete] = useState(false)
  usePageTitle(roadmap?.name)

  // A roadmap made before views existed gets them now, once.
  const viewCount = data.views.length
  useEffect(() => {
    if (roadmap && viewCount < 3) void ensureViews(roadmap.id)
  }, [roadmap, viewCount])

  // Ctrl or Cmd Z undoes the last edit, unless you are typing in a field (where it means undo typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const el = e.target as HTMLElement | null
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      )
        return
      e.preventDefault()
      void undoLatest()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!roadmap) {
    return (
      <EmptyState
        icon={<Layers />}
        title="That roadmap does not exist"
        description="It may have been deleted. Your other roadmaps are on the roadmaps page."
        action={
          <Button asChild variant="outline">
            <Link to="/app/roadmaps">All roadmaps</Link>
          </Button>
        }
      />
    )
  }

  const requested = params.get('view')
  const view: View = isView(requested) ? requested : (roadmap.defaultView ?? 'now-next-later')
  const setView = (v: View) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', v)
      return next
    })

  const meta = [
    roadmap.planningHorizon && HORIZON_LABELS[roadmap.planningHorizon],
    roadmap.planningMode === 'dates' ? 'Date-based' : 'Flexible',
    pluralise(rows.length, 'item'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={roadmap.name}
        description={roadmap.description}
        meta={meta}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void undoLatest()}
              disabled={!lastUndo}
              aria-label={lastUndo ? `Undo: ${lastUndo.label}` : 'Nothing to undo'}
              title={lastUndo ? lastUndo.label : 'Nothing to undo'}
            >
              <Undo2 aria-hidden /> Undo
            </Button>
            <Button variant="outline" onClick={() => openRoadmapForm(roadmap.id)}>
              <Settings2 aria-hidden /> Settings
            </Button>
            <Button variant="primary" onClick={() => openAddItems(roadmap.id)}>
              <Plus aria-hidden /> Add items
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More roadmap actions">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openSaveTemplate(roadmap.id)}>
                  <LayoutTemplate aria-hidden /> Save as template
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden /> Delete roadmap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div role="tablist" aria-label="Roadmap view" className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="tab"
            type="button"
            id={`tab-${v.value}`}
            aria-selected={view === v.value}
            aria-controls="roadmap-panel"
            onClick={() => setView(v.value)}
            className={cn(
              'h-9 rounded-full px-3.5 text-body font-medium whitespace-nowrap transition-colors',
              view === v.value
                ? 'bg-primary-soft font-semibold text-primary-text'
                : 'text-muted-foreground hover:bg-sand hover:text-foreground',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <FilterBar
          filters={filters}
          onChange={setFilter}
          onClear={clearFilters}
          noun="items"
          shown={filtered.length}
          total={rows.length}
          searchLabel="Search this roadmap"
          statuses={WORK_STATUS_OPTIONS}
          showPriority
          initiatives={initiatives}
        />
      )}

      <div role="tabpanel" id="roadmap-panel" aria-labelledby={`tab-${view}`}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="This roadmap is empty"
            description="Add initiatives and features from your plan. Each can sit on a roadmap once, and every view shows the same items."
            action={
              <Button variant="outline" onClick={() => openAddItems(roadmap.id)}>
                <Plus aria-hidden /> Add items
              </Button>
            }
          />
        ) : filtered.length === 0 && filtering ? (
          <EmptyState
            title="No items match"
            description="Try a different search, or clear the filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : view === 'now-next-later' ? (
          <NowNextLaterView data={data} />
        ) : view === 'timeline' ? (
          <TimelineView data={data} />
        ) : (
          <BoardView data={data} />
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${roadmap.name}”?`}
        description="The roadmap goes away. Your initiatives and features stay exactly as they are, and you can undo this straight afterwards."
        confirmLabel="Delete roadmap"
        destructive
        onConfirm={async () => {
          if (await deleteRoadmap(roadmap.id)) navigate('/app/roadmaps')
        }}
      />
    </div>
  )
}
