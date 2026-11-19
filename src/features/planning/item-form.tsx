import { Trash2 } from 'lucide-react'
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
  PRIORITIES,
  WORK_STATUSES,
  type Feature,
  type Initiative,
  type Priority,
  type WorkStatus,
} from '@/domain'
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/labels'
import { toStorageError } from '@/storage'
import { useItemDrawer, type DrawerTarget } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { TagPicker } from './tag-picker'

type Kind = 'initiative' | 'feature'

const SCORE_HINTS = {
  impact: ['Low', 'High'],
  confidence: ['Low', 'High'],
  effort: ['Small', 'Large'],
} as const

function ScoreSelect({
  label,
  kind,
  value,
  onChange,
  error,
}: {
  label: string
  kind: keyof typeof SCORE_HINTS
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const [low, high] = SCORE_HINTS[kind]
  return (
    <Field label={label} error={error}>
      {(c) => (
        <Select {...c} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not set</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n === 1 ? `1, ${low.toLowerCase()}` : n === 5 ? `5, ${high.toLowerCase()}` : n}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

const optional = (s: string) => (s.trim() === '' ? undefined : s)
const score = (s: string) => (s === '' ? undefined : Number(s))

/**
 * The form for an initiative or a feature. They share almost every field: a feature estimates impact and
 * effort; an initiative also records confidence.
 */
export function ItemForm({ kind, target }: { kind: Kind; target: DrawerTarget }) {
  const { close, askDelete } = useItemDrawer()
  const { objectives, initiatives, features, tags } = usePlanningStore()
  const saveInitiative = usePlanningStore((s) => s.saveInitiative)
  const saveFeature = usePlanningStore((s) => s.saveFeature)

  const existing: Initiative | Feature | undefined =
    target.id === undefined
      ? undefined
      : kind === 'initiative'
        ? initiatives.find((i) => i.id === target.id)
        : features.find((f) => f.id === target.id)
  const missing = target.id !== undefined && !existing
  useEffect(() => {
    if (missing) close()
  }, [missing, close])

  const parentOf = (x?: Initiative | Feature) =>
    x
      ? kind === 'initiative'
        ? (x as Initiative).objectiveId
        : (x as Feature).initiativeId
      : undefined
  const [values, setValues] = useState(() => ({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    parentId:
      parentOf(existing) ??
      (kind === 'initiative' ? target.preset?.objectiveId : target.preset?.initiativeId) ??
      '',
    status: (existing?.status ?? 'idea') as WorkStatus,
    priority: (existing?.priority ?? '') as Priority | '',
    impact: String(existing?.scoring?.impact ?? ''),
    confidence: String(existing?.scoring?.confidence ?? ''),
    effort: String(existing?.scoring?.effort ?? ''),
    owner: existing?.owner ?? '',
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
  }))
  const [tagState, setTagState] = useState({
    selected: existing?.tagIds ?? [],
    pending: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  if (missing) return null

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((x) => ({ ...x, [k]: v }))
  const noun = kind === 'initiative' ? 'initiative' : 'feature'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError(undefined)
    const hasScore = values.impact || values.effort || (kind === 'initiative' && values.confidence)
    const scoring = hasScore
      ? {
          impact: score(values.impact),
          effort: score(values.effort),
          ...(kind === 'initiative' ? { confidence: score(values.confidence) } : {}),
        }
      : undefined
    const common = {
      title: values.title,
      description: optional(values.description),
      status: values.status,
      priority: values.priority || undefined,
      scoring,
      owner: optional(values.owner),
      startDate: optional(values.startDate),
      endDate: optional(values.endDate),
      tagIds: tagState.selected,
      newTags: tagState.pending,
    }
    try {
      if (kind === 'initiative')
        await saveInitiative({ ...common, objectiveId: values.parentId || undefined }, target.id)
      else await saveFeature({ ...common, initiativeId: values.parentId || undefined }, target.id)
      toast.success(
        target.id
          ? `${kind === 'initiative' ? 'Initiative' : 'Feature'} saved`
          : `${kind === 'initiative' ? 'Initiative' : 'Feature'} created`,
        values.title.trim(),
      )
      close()
    } catch (err) {
      const se = toStorageError(err)
      if (se.code === 'VALIDATION') {
        // The parent field is called objectiveId / initiativeId in the data and "parentId" here.
        const map = { ...se.fieldErrors }
        const parentKey = kind === 'initiative' ? 'objectiveId' : 'initiativeId'
        if (map[parentKey]) map.parentId = map[parentKey]
        setErrors(map)
      } else setFormError(`${se.message} ${se.recovery}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>{target.id ? `Edit ${noun}` : `New ${noun}`}</DrawerTitle>
        <DrawerDescription>
          {kind === 'initiative'
            ? 'A chunk of work, chosen because it should move an objective.'
            : 'A piece of an initiative that you could build and ship.'}
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
        <Field label={kind === 'initiative' ? 'Initiative' : 'Feature'} error={errors.title}>
          {(c) => (
            <Input
              {...c}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              maxLength={200}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Description" note="optional" error={errors.description}>
          {(c) => (
            <Textarea
              {...c}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          )}
        </Field>

        <Field
          label={kind === 'initiative' ? 'Objective' : 'Initiative'}
          error={errors.parentId}
          hint={
            kind === 'initiative'
              ? 'The outcome this should move.'
              : 'The chunk of work this belongs to.'
          }
        >
          {(c) => (
            <Select
              {...c}
              value={values.parentId}
              onChange={(e) => set('parentId', e.target.value)}
            >
              <option value="">{kind === 'initiative' ? 'No objective' : 'No initiative'}</option>
              {kind === 'initiative'
                ? objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))
                : initiatives.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
            </Select>
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Status" error={errors.status}>
            {(c) => (
              <Select
                {...c}
                value={values.status}
                onChange={(e) => set('status', e.target.value as WorkStatus)}
              >
                {WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority" note="optional" error={errors.priority}>
            {(c) => (
              <Select
                {...c}
                value={values.priority}
                onChange={(e) => set('priority', e.target.value as Priority | '')}
              >
                <option value="">Not set</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-title font-semibold text-foreground">Estimates</legend>
          <div
            className={
              kind === 'initiative' ? 'grid gap-4 sm:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'
            }
          >
            <ScoreSelect
              label="Expected impact"
              kind="impact"
              value={values.impact}
              onChange={(v) => set('impact', v)}
              error={errors['scoring.impact']}
            />
            {kind === 'initiative' && (
              <ScoreSelect
                label="Confidence"
                kind="confidence"
                value={values.confidence}
                onChange={(v) => set('confidence', v)}
                error={errors['scoring.confidence']}
              />
            )}
            <ScoreSelect
              label="Effort"
              kind="effort"
              value={values.effort}
              onChange={(v) => set('effort', v)}
              error={errors['scoring.effort']}
            />
          </div>
          <p className="text-caption text-muted-foreground">
            Each is 1 to 5. Impact and confidence: higher is better. Effort: higher is more work.
          </p>
        </fieldset>

        <Field label="Owner" note="optional" error={errors.owner}>
          {(c) => (
            <Input
              {...c}
              value={values.owner}
              onChange={(e) => set('owner', e.target.value)}
              maxLength={120}
              autoComplete="off"
              placeholder="Who is responsible?"
            />
          )}
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Start date" note="optional" error={errors.startDate}>
            {(c) => (
              <Input
                {...c}
                type="date"
                value={values.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            )}
          </Field>
          <Field label="End date" note="optional" error={errors.endDate}>
            {(c) => (
              <Input
                {...c}
                type="date"
                value={values.endDate}
                onChange={(e) => set('endDate', e.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Tags" note="optional" error={errors.tagIds}>
          {(c) => (
            <TagPicker
              id={c.id}
              tags={tags}
              selected={tagState.selected}
              pending={tagState.pending}
              onChange={setTagState}
            />
          )}
        </Field>
      </DrawerBody>
      <DrawerFooter className="justify-between">
        {target.id ? (
          <Button
            variant="destructive"
            onClick={() => askDelete(kind, target.id!)}
            disabled={saving}
          >
            <Trash2 aria-hidden /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {target.id ? 'Save changes' : `Create ${noun}`}
          </Button>
        </div>
      </DrawerFooter>
    </form>
  )
}
