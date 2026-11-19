import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import {
  PLANNING_HORIZONS,
  ROADMAP_ITEM_TYPES,
  type PlanningHorizon,
  type PlanningMode,
  type RoadmapItemType,
} from '@/domain'
import { HORIZON_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { toStorageError } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { useNavigate } from 'react-router-dom'
import { saveRoadmap } from './actions'

type View = 'now-next-later' | 'timeline' | 'board'
const VIEWS: { value: View; label: string }[] = [
  { value: 'now-next-later', label: 'Now, next, later' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'board', label: 'Board' },
]
const TYPE_LABELS: Record<RoadmapItemType, string> = {
  initiative: 'Initiatives',
  feature: 'Features',
  milestone: 'Milestones',
}
const MODES: { value: PlanningMode; title: string; body: string }[] = [
  {
    value: 'flexible',
    title: 'Flexible',
    body: 'You choose now, next or later. Dates are optional and moving a card never changes them.',
  },
  {
    value: 'dates',
    title: 'Date-based',
    body: 'Now, next and later follow each item’s dates. Moving a dated card to another column changes its dates.',
  },
]

/** Create a roadmap or change its settings. */
export function RoadmapForm({ id }: { id?: string }) {
  const { roadmaps, initiatives } = usePlanningStore()
  const { closeRoadmapForm } = useItemDrawer()
  const navigate = useNavigate()
  const existing = roadmaps.find((r) => r.id === id)
  const missing = Boolean(id) && !existing
  useEffect(() => {
    if (missing) closeRoadmapForm()
  }, [missing, closeRoadmapForm])

  const [values, setValues] = useState(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    horizon: (existing?.planningHorizon ?? '') as PlanningHorizon | '',
    defaultView: (existing?.defaultView ?? 'now-next-later') as View,
    mode: (existing?.planningMode ?? 'flexible') as PlanningMode,
    types: new Set<RoadmapItemType>(existing?.itemTypes ?? ROADMAP_ITEM_TYPES),
    include: initiatives.length > 0,
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  if (missing) return null

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((x) => ({ ...x, [k]: v }))
  const toggleType = (t: RoadmapItemType, on: boolean) => {
    const next = new Set(values.types)
    if (on) next.add(t)
    else next.delete(t)
    set('types', next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError(undefined)
    const itemTypes = ROADMAP_ITEM_TYPES.filter((t) => values.types.has(t))
    try {
      const saved = await saveRoadmap(
        id,
        {
          name: values.name,
          description: values.description.trim() === '' ? undefined : values.description,
          planningHorizon: values.horizon || undefined,
          defaultView: values.defaultView,
          planningMode: values.mode,
          itemTypes,
        },
        !id && values.include,
      )
      toast.success(id ? 'Roadmap saved' : 'Roadmap created', saved.name)
      closeRoadmapForm()
      if (!id) navigate(`/app/roadmaps/${saved.id}`)
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
        <DrawerTitle>{id ? 'Roadmap settings' : 'New roadmap'}</DrawerTitle>
        <DrawerDescription>
          One roadmap, three ways to see it. You can change any of this later.
        </DrawerDescription>
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
        <Field label="Name" error={errors.name}>
          {(c) => (
            <Input
              {...c}
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
              maxLength={200}
              autoComplete="off"
              placeholder="Public roadmap"
            />
          )}
        </Field>
        <Field label="Description" note="optional" error={errors.description}>
          {(c) => (
            <Textarea
              {...c}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
            />
          )}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Planning horizon" note="optional" error={errors.planningHorizon}>
            {(c) => (
              <Select
                {...c}
                value={values.horizon}
                onChange={(e) => set('horizon', e.target.value as PlanningHorizon | '')}
              >
                <option value="">Not set</option>
                {PLANNING_HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {HORIZON_LABELS[h]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Opens in" error={errors.defaultView}>
            {(c) => (
              <Select
                {...c}
                value={values.defaultView}
                onChange={(e) => set('defaultView', e.target.value as View)}
              >
                {VIEWS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-title font-semibold text-foreground">
            How do you plan?
          </legend>
          {MODES.map((m) => (
            <label
              key={m.value}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-input border p-3.5 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40',
                values.mode === m.value ? 'border-primary-text bg-primary-soft' : 'hover:bg-sand',
              )}
            >
              <input
                type="radio"
                name="mode"
                checked={values.mode === m.value}
                onChange={() => set('mode', m.value)}
                className="mt-1 size-4 accent-[var(--primary-text)]"
              />
              <span>
                <span className="block text-body font-semibold text-foreground">{m.title}</span>
                <span className="mt-0.5 block text-caption text-muted-foreground">{m.body}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-title font-semibold text-foreground">
            What does it show?
          </legend>
          {ROADMAP_ITEM_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-3 text-body text-foreground"
            >
              <input
                type="checkbox"
                checked={values.types.has(t)}
                onChange={(e) => toggleType(t, e.target.checked)}
                className="size-4 accent-[var(--primary-text)]"
              />
              {TYPE_LABELS[t]}
            </label>
          ))}
          {errors.itemTypes && (
            <p role="alert" className="text-caption font-medium text-destructive">
              {errors.itemTypes}
            </p>
          )}
          <p className="text-caption text-muted-foreground">
            Hiding a kind only hides it here. Nothing is removed from the roadmap.
          </p>
        </fieldset>

        {!id && initiatives.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-input border p-3.5">
            <input
              type="checkbox"
              checked={values.include}
              onChange={(e) => set('include', e.target.checked)}
              className="mt-1 size-4 accent-[var(--primary-text)]"
            />
            <span>
              <span className="block text-body font-semibold text-foreground">
                Start with my initiatives
              </span>
              <span className="mt-0.5 block text-caption text-muted-foreground">
                Adds your {initiatives.length}{' '}
                {initiatives.length === 1 ? 'initiative' : 'initiatives'}, placed by how far along
                they are. Dropped ones are left out.
              </span>
            </span>
          </label>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={closeRoadmapForm} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {id ? 'Save settings' : 'Create roadmap'}
        </Button>
      </DrawerFooter>
    </form>
  )
}
