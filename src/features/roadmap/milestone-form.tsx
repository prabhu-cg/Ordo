import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { MILESTONE_STATUSES, type Milestone } from '@/domain'
import { toStorageError } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { deleteMilestone, saveMilestone } from './actions'

const STATUS_TEXT: Record<Milestone['status'], string> = {
  upcoming: 'Upcoming',
  reached: 'Reached',
  missed: 'Missed',
}

/** A date worth marking on the timeline, on its own or tied to an initiative. */
export function MilestoneForm({ id, date }: { id?: string; date?: string }) {
  const { milestones, initiatives } = usePlanningStore()
  const { closeMilestone } = useItemDrawer()
  const existing = milestones.find((m) => m.id === id)
  const missing = Boolean(id) && !existing
  useEffect(() => {
    if (missing) closeMilestone()
  }, [missing, closeMilestone])

  const [values, setValues] = useState(() => ({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    date: existing?.date ?? date ?? '',
    status: (existing?.status ?? 'upcoming') as Milestone['status'],
    initiativeId: existing?.initiativeId ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  if (missing) return null
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((x) => ({ ...x, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError(undefined)
    try {
      await saveMilestone(
        {
          title: values.title,
          description: values.description.trim() === '' ? undefined : values.description,
          date: values.date,
          status: values.status,
          initiativeId: values.initiativeId || undefined,
        },
        id,
      )
      toast.success(id ? 'Milestone saved' : 'Milestone added', values.title.trim())
      closeMilestone()
    } catch (err) {
      const se = toStorageError(err)
      if (se.code === 'VALIDATION') setErrors(se.fieldErrors)
      else setFormError(`${se.message} ${se.recovery}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>{id ? 'Edit milestone' : 'New milestone'}</DrawerTitle>
        <DrawerDescription>A date worth marking on the timeline.</DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-6">
        {formError && (
          <p
            role="alert"
            className="rounded-input bg-destructive-soft px-4 py-3 text-body text-destructive"
          >
            {formError}
          </p>
        )}
        <Field label="Milestone" error={errors.title}>
          {(c) => (
            <Input
              {...c}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              maxLength={200}
              autoComplete="off"
              placeholder="Public launch"
            />
          )}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Date" error={errors.date}>
            {(c) => (
              <Input
                {...c}
                type="date"
                value={values.date}
                onChange={(e) => set('date', e.target.value)}
              />
            )}
          </Field>
          <Field label="Status" error={errors.status}>
            {(c) => (
              <Select
                {...c}
                value={values.status}
                onChange={(e) => set('status', e.target.value as Milestone['status'])}
              >
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_TEXT[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field
          label="Linked initiative"
          note="optional"
          error={errors.initiativeId}
          hint="Leave empty for a milestone that stands on its own."
        >
          {(c) => (
            <Select
              {...c}
              value={values.initiativeId}
              onChange={(e) => set('initiativeId', e.target.value)}
            >
              <option value="">None</option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Notes" note="optional" error={errors.description}>
          {(c) => (
            <Textarea
              {...c}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          )}
        </Field>
      </DrawerBody>
      <DrawerFooter className="justify-between">
        {id ? (
          <Button variant="destructive" onClick={() => setConfirming(true)} disabled={saving}>
            <Trash2 aria-hidden /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={closeMilestone} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {id ? 'Save changes' : 'Add milestone'}
          </Button>
        </div>
      </DrawerFooter>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${existing?.title ?? 'milestone'}”?`}
        description="It comes off the timeline. You can undo this straight afterwards."
        confirmLabel="Delete milestone"
        destructive
        onConfirm={async () => {
          if (id && (await deleteMilestone(id))) closeMilestone()
        }}
      />
    </form>
  )
}
