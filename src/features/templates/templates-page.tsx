import { Copy, LayoutTemplate, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
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
import { usePageTitle } from '@/features/marketing/use-page-title'
import { HORIZON_LABELS } from '@/lib/labels'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { describeTemplate } from '@/templates'
import { deleteTemplate, duplicateTemplate } from './actions'
import { useTemplates, type TemplateEntry } from './use-templates'

const VIEW = { 'now-next-later': 'Now, next, later', timeline: 'Timeline', board: 'Board' } as const

export function TemplatesPage() {
  usePageTitle('Templates')
  return (
    <StorageGate>
      <TemplatesContent />
    </StorageGate>
  )
}

function TemplatesContent() {
  const { all } = useTemplates()
  const builtIn = all.filter((e) => e.builtIn)
  const mine = all.filter((e) => !e.builtIn)
  const openSave = useItemDrawer((s) => s.openSaveTemplate)
  const roadmapCount = usePlanningStore((s) => s.roadmaps.length)
  const [deleting, setDeleting] = useState<TemplateEntry>()

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        title="Templates"
        description="Start a product from a ready-made plan, or keep your own roadmaps as templates to reuse."
        actions={
          <Button
            variant="primary"
            onClick={() => openSave()}
            disabled={roadmapCount === 0}
            title={roadmapCount === 0 ? 'Make a roadmap in your open product first' : undefined}
          >
            <Plus aria-hidden /> Save a roadmap as a template
          </Button>
        }
      />

      <section aria-labelledby="mine-heading" className="flex flex-col gap-3">
        <h2 id="mine-heading" className="text-xl">
          Your templates{' '}
          <span className="font-sans text-body font-normal text-muted-foreground tabular-nums">
            {mine.length}
          </span>
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            icon={<LayoutTemplate />}
            title="You have not saved a template yet"
            description={
              roadmapCount === 0
                ? 'Build a roadmap in a product, then save its structure here to start the next product from it.'
                : 'Save one of your roadmaps and its structure is ready to start a new product from.'
            }
            action={
              roadmapCount > 0 ? (
                <Button variant="outline" onClick={() => openSave()}>
                  <Plus aria-hidden /> Save a roadmap as a template
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TemplateList entries={mine} onDelete={setDeleting} />
        )}
      </section>

      <section aria-labelledby="starter-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="starter-heading" className="text-xl">
            Starter templates
          </h2>
          <p className="mt-1 text-body text-muted-foreground">
            Ready-made plans. Everything in them is sample data, there to be replaced with your own.
          </p>
        </div>
        <TemplateList entries={builtIn} onDelete={setDeleting} />
      </section>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete “${deleting?.template.name ?? 'template'}”?`}
        description="The template goes away. Products already made from it are not affected, and you can undo this straight afterwards."
        confirmLabel="Delete template"
        destructive
        onConfirm={async () => {
          if (deleting) await deleteTemplate(deleting.template.id, deleting.template.name)
        }}
      />
    </div>
  )
}

function TemplateList({
  entries,
  onDelete,
}: {
  entries: TemplateEntry[]
  onDelete: (e: TemplateEntry) => void
}) {
  const openEdit = useItemDrawer((s) => s.openEditTemplate)
  return (
    <ul className="border-b">
      {entries.map((e) => {
        const t = e.template
        return (
          <li
            key={t.id}
            className="flex flex-col gap-3 border-t py-5 lg:flex-row lg:items-start lg:justify-between"
          >
            <div className="max-w-2xl min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 font-sans text-title font-semibold text-foreground">
                {t.name}
                {e.builtIn && <Badge variant="secondary">Sample data</Badge>}
              </h3>
              <p className="mt-1 text-body">{t.summary}</p>
              <p className="mt-1 text-caption text-muted-foreground">{t.bestFor}</p>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                <Badge variant="outline">
                  {t.structure.planningMode === 'dates' ? 'Date-based' : 'Flexible'}
                </Badge>
                <Badge variant="outline">
                  Opens in {VIEW[t.structure.defaultView].toLowerCase()}
                </Badge>
                <Badge variant="outline">{HORIZON_LABELS[t.structure.horizon]}</Badge>
                <span className="tabular-nums">{describeTemplate(t)}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/app/example?template=${t.id}`} aria-label={`Preview ${t.name}`}>
                  Preview
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void duplicateTemplate(e.builtIn ? t : t.id)}
                aria-label={`Duplicate ${t.name}`}
              >
                <Copy aria-hidden /> Duplicate
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link to={`/app/new?template=${t.id}`} aria-label={`Create product from ${t.name}`}>
                  Create product
                </Link>
              </Button>
              {!e.builtIn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(t.id)}>
                      <Pencil aria-hidden /> Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem destructive onSelect={() => onDelete(e)}>
                      <Trash2 aria-hidden /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
