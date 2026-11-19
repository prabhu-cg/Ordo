import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { pluralise } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toStorageError, type DeleteStrategy } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'

function Choice({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean
  onChange: () => void
  title: string
  body: string
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-input border p-3.5 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40',
        checked ? 'border-primary-text bg-primary-soft' : 'hover:bg-sand',
      )}
    >
      <input
        type="radio"
        name="delete-strategy"
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 accent-[var(--primary-text)]"
      />
      <span>
        <span className="block text-body font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-caption text-muted-foreground">{body}</span>
      </span>
    </label>
  )
}

/**
 * Deleting never happens without a confirmation that says exactly what goes with it. A parent that has
 * children asks what should become of them: keep them (unlinked) or delete them too.
 */
export function DeleteDialog() {
  const { deleting, cancelDelete, close } = useItemDrawer()
  const {
    objectives,
    initiatives,
    features,
    roadmaps,
    deleteObjective,
    deleteInitiative,
    deleteFeature,
  } = usePlanningStore()
  const [strategy, setStrategy] = useState<DeleteStrategy>('unlink')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const item =
    deleting?.kind === 'objective'
      ? objectives.find((o) => o.id === deleting.id)
      : deleting?.kind === 'initiative'
        ? initiatives.find((i) => i.id === deleting.id)
        : features.find((f) => f.id === deleting?.id)
  const name = item?.title ?? ''

  const childInitiatives =
    deleting?.kind === 'objective' ? initiatives.filter((i) => i.objectiveId === deleting.id) : []
  const childFeatures =
    deleting?.kind === 'objective'
      ? features.filter((f) => childInitiatives.some((i) => i.id === f.initiativeId))
      : deleting?.kind === 'initiative'
        ? features.filter((f) => f.initiativeId === deleting.id)
        : []
  const onRoadmaps =
    deleting && deleting.kind !== 'objective'
      ? roadmaps.filter((r) => r.entries.some((e) => e.itemId === deleting.id)).length
      : 0
  const hasChildren =
    deleting?.kind === 'objective'
      ? childInitiatives.length > 0
      : deleting?.kind === 'initiative'
        ? childFeatures.length > 0
        : false

  const reset = () => {
    setStrategy('unlink')
    setError(undefined)
  }
  const dismiss = () => {
    if (busy) return
    cancelDelete()
    reset()
  }

  async function confirm() {
    if (!deleting) return
    setBusy(true)
    setError(undefined)
    try {
      if (deleting.kind === 'objective') await deleteObjective(deleting.id, strategy)
      else if (deleting.kind === 'initiative') await deleteInitiative(deleting.id, strategy)
      else await deleteFeature(deleting.id)
      toast.success(`${deleting.kind[0]!.toUpperCase()}${deleting.kind.slice(1)} deleted`, name)
      cancelDelete()
      close() // the item the drawer was editing no longer exists
      reset()
    } catch (e) {
      setError(toStorageError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const cascade = strategy === 'cascade' && hasChildren
  const confirmLabel = !cascade
    ? `Delete ${deleting?.kind ?? ''}`
    : deleting?.kind === 'objective'
      ? `Delete objective and ${pluralise(childInitiatives.length, 'initiative')}`
      : `Delete initiative and ${pluralise(childFeatures.length, 'feature')}`

  return (
    <Dialog open={Boolean(deleting && item)} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name ? `“${name}”` : 'this item'}?</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-1">
              {!hasChildren && (
                <p>
                  It will be removed from your plan.
                  {onRoadmaps > 0 &&
                    ` It is on ${pluralise(onRoadmaps, 'roadmap')} and will be taken off.`}
                </p>
              )}
              {hasChildren && deleting?.kind === 'objective' && (
                <p>
                  This objective has {pluralise(childInitiatives.length, 'initiative')} and{' '}
                  {pluralise(childFeatures.length, 'feature')} under it. Choose what happens to
                  them.
                </p>
              )}
              {hasChildren && deleting?.kind === 'initiative' && (
                <p>
                  This initiative has {pluralise(childFeatures.length, 'feature')}. Choose what
                  happens to them.
                  {onRoadmaps > 0 &&
                    ` It is on ${pluralise(onRoadmaps, 'roadmap')} and will be taken off.`}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2.5">
          {hasChildren && deleting?.kind === 'objective' && (
            <>
              <Choice
                checked={strategy === 'unlink'}
                onChange={() => setStrategy('unlink')}
                title="Keep the initiatives"
                body={`${pluralise(childInitiatives.length, 'initiative')} and their features stay, with no objective.`}
              />
              <Choice
                checked={strategy === 'cascade'}
                onChange={() => setStrategy('cascade')}
                title="Delete them too"
                body={`${pluralise(childInitiatives.length, 'initiative')} and ${pluralise(childFeatures.length, 'feature')} are deleted. This cannot be undone from the app.`}
              />
            </>
          )}
          {hasChildren && deleting?.kind === 'initiative' && (
            <>
              <Choice
                checked={strategy === 'unlink'}
                onChange={() => setStrategy('unlink')}
                title="Keep the features"
                body={`${pluralise(childFeatures.length, 'feature')} stay, with no initiative.`}
              />
              <Choice
                checked={strategy === 'cascade'}
                onChange={() => setStrategy('cascade')}
                title="Delete them too"
                body={`${pluralise(childFeatures.length, 'feature')} are deleted. This cannot be undone from the app.`}
              />
            </>
          )}
          {error && (
            <p role="alert" className="text-caption font-medium text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} loading={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
