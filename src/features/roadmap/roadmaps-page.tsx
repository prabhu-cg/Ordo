import { Map as MapIcon, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { PlanningGate } from '@/features/planning/planning-gate'
import { usePageTitle } from '@/features/marketing/use-page-title'
import type { Roadmap } from '@/domain'
import { formatDate, pluralise } from '@/lib/format'
import { HORIZON_LABELS } from '@/lib/labels'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { deleteRoadmap } from './actions'

const VIEW_LABEL = {
  'now-next-later': 'Now, next, later',
  timeline: 'Timeline',
  board: 'Board',
} as const

export function RoadmapsPage() {
  usePageTitle('Roadmaps')
  return (
    <PlanningGate title="Roadmaps">
      <RoadmapsContent />
    </PlanningGate>
  )
}

function RoadmapsContent() {
  const { roadmaps } = usePlanningStore()
  const openForm = useItemDrawer((s) => s.openRoadmapForm)
  const [deleting, setDeleting] = useState<Roadmap>()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Roadmaps"
        description="Each roadmap picks items from your plan and shows them three ways: now, next, later; a timeline; and a board."
        actions={
          <Button variant="primary" onClick={() => openForm()}>
            <Plus aria-hidden /> New roadmap
          </Button>
        }
      />
      {roadmaps.length === 0 ? (
        <EmptyState
          icon={<MapIcon />}
          title="No roadmaps yet"
          description="Make one for your team, your clients or yourself. You can make several from the same plan."
          action={
            <Button variant="outline" onClick={() => openForm()}>
              <Plus aria-hidden /> Create your first roadmap
            </Button>
          }
        />
      ) : (
        <ul className="border-b">
          {roadmaps.map((r) => {
            const initiatives = r.entries.filter((e) => e.itemType === 'initiative').length
            const features = r.entries.length - initiatives
            return (
              <li
                key={r.id}
                className="flex flex-col gap-3 border-t py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="max-w-2xl min-w-0">
                  <h2 className="font-sans text-title font-semibold break-words text-foreground">
                    <Link
                      to={`/app/roadmaps/${r.id}`}
                      className="rounded-sm hover:text-primary-text hover:underline hover:underline-offset-4"
                    >
                      {r.name}
                    </Link>
                  </h2>
                  {r.description && (
                    <p className="mt-1 text-body text-muted-foreground">{r.description}</p>
                  )}
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                    <Badge variant="outline">{VIEW_LABEL[r.defaultView ?? 'now-next-later']}</Badge>
                    <Badge variant="secondary">
                      {r.planningMode === 'dates' ? 'Date-based' : 'Flexible'}
                    </Badge>
                    {r.planningHorizon && <span>{HORIZON_LABELS[r.planningHorizon]}</span>}
                    <span className="tabular-nums">
                      {pluralise(initiatives, 'initiative')} · {pluralise(features, 'feature')} ·
                      Updated {formatDate(r.updatedAt)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/app/roadmaps/${r.id}`} aria-label={`Open ${r.name}`}>
                      Open
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.name}`}>
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openForm(r.id)}>
                        <Pencil aria-hidden /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem destructive onSelect={() => setDeleting(r)}>
                        <Trash2 aria-hidden /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete “${deleting?.name ?? 'roadmap'}”?`}
        description="The roadmap goes away. Your initiatives and features stay exactly as they are, and you can undo this straight afterwards."
        confirmLabel="Delete roadmap"
        destructive
        onConfirm={async () => {
          if (deleting) await deleteRoadmap(deleting.id)
        }}
      />
    </div>
  )
}
