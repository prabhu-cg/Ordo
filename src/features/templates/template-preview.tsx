import { RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HORIZON_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { BoardView } from '@/features/roadmap/board-view'
import { BindingsProvider } from '@/features/roadmap/bindings'
import { NowNextLaterView } from '@/features/roadmap/nnl-view'
import { TimelineView } from '@/features/roadmap/timeline-view'
import type { RoadmapData } from '@/features/roadmap/use-roadmap'
import type { TemplateDefinition } from '@/domain'
import { resolveTemplate } from '@/templates'
import { TemplateItemDrawer } from './template-item-drawer'
import { useSandbox } from './sandbox'

type View = 'now-next-later' | 'timeline' | 'board'
const VIEWS: { value: View; label: string }[] = [
  { value: 'now-next-later', label: 'Now, next, later' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'board', label: 'Board' },
]

/**
 * Explore a template: its roadmap in all three views, using the same views as your own roadmaps, on a throwaway
 * copy. Drag cards, change status, resize bars: none of it is saved, and Reset puts the template back.
 */
export function TemplatePreview({
  template,
  sample,
}: {
  template: TemplateDefinition
  /** Built-in templates hold sample data. */ sample: boolean
}) {
  const make = useCallback(
    () => resolveTemplate(template, { product: { name: template.name }, sample }),
    [template, sample],
  )
  const sandbox = useSandbox(make)
  const [view, setView] = useState<View>(template.structure.defaultView)
  const data = sandbox.data as unknown as RoadmapData

  return (
    <div className="flex flex-col gap-6">
      <Alert
        tone="info"
        title={
          sample ? 'Sample data, and a preview you can play with' : 'A preview you can play with'
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={sandbox.reset}
            className="shrink-0 self-center"
            disabled={!sandbox.changed}
          >
            <RotateCcw aria-hidden /> Reset preview
          </Button>
        }
      >
        {sample
          ? 'Everything here is example content that shows how this kind of plan can look. '
          : ''}
        Drag cards, change a status, resize a bar or switch views. Nothing is saved, and Reset puts
        the template back as it was.
        {sandbox.changed && (
          <span className="mt-1 block font-semibold text-foreground">
            You have changed this preview.
          </span>
        )}
      </Alert>

      <section aria-labelledby="structure-heading" className="max-w-3xl">
        <h2 id="structure-heading" className="font-sans text-title font-semibold text-foreground">
          Suggested planning structure
        </h2>
        <p className="mt-1 text-body">{template.structure.note}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            {template.structure.planningMode === 'dates' ? 'Date-based' : 'Flexible'}
          </Badge>
          <Badge variant="outline">
            Opens in{' '}
            {VIEWS.find((v) => v.value === template.structure.defaultView)!.label.toLowerCase()}
          </Badge>
          <Badge variant="outline">{HORIZON_LABELS[template.structure.horizon]}</Badge>
        </p>
      </section>

      <div role="tablist" aria-label="Preview view" className="flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            role="tab"
            type="button"
            id={`preview-tab-${v.value}`}
            aria-selected={view === v.value}
            aria-controls="preview-panel"
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

      <div
        role="tabpanel"
        id="preview-panel"
        aria-labelledby={`preview-tab-${view}`}
        key={sandbox.version}
      >
        <BindingsProvider value={sandbox.bindings}>
          {view === 'now-next-later' ? (
            <NowNextLaterView data={data} />
          ) : view === 'timeline' ? (
            <TimelineView data={data} />
          ) : (
            <BoardView data={data} />
          )}
        </BindingsProvider>
      </div>

      <TemplateItemDrawer
        records={sandbox.records}
        openId={sandbox.openId}
        links={sandbox.data.links}
        onClose={sandbox.closeItem}
      />
    </div>
  )
}
