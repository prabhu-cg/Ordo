import { Plus, Trash2 } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/toast'
import { OBJECTIVE_STATUSES, asPercent, newId, outcomeProgress, type Objective } from '@/domain'
import { OBJECTIVE_STATUS_LABELS } from '@/lib/labels'
import { toStorageError } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'

interface OutcomeRow {
  key: string
  id: string
  title: string
  metric: string
  unit: string
  baseline: string
  target: string
  current: string
}

const blankRow = (): OutcomeRow => ({
  key: newId(),
  id: '',
  title: '',
  metric: '',
  unit: '',
  baseline: '0',
  target: '',
  current: '0',
})
const asText = (n: number) => String(n)
/** Empty input is "not a number", so the schema can say so, instead of silently becoming 0. */
const toNumber = (s: string) => (s.trim() === '' ? Number.NaN : Number(s))
const optional = (s: string) => (s.trim() === '' ? undefined : s)

export function ObjectiveForm({ id }: { id?: string }) {
  const objective = usePlanningStore((s) => s.objectives.find((o) => o.id === id))
  const saveObjective = usePlanningStore((s) => s.saveObjective)
  const { close, askDelete } = useItemDrawer()
  const missing = Boolean(id) && !objective
  useEffect(() => {
    if (missing) close() // it was deleted somewhere else while this was open
  }, [missing, close])

  const [values, setValues] = useState(() => ({
    title: objective?.title ?? '',
    description: objective?.description ?? '',
    status: (objective?.status ?? 'active') as Objective['status'],
    targetDate: objective?.targetDate ?? '',
  }))
  const [rows, setRows] = useState<OutcomeRow[]>(() =>
    (objective?.outcomes ?? []).map((o) => ({
      key: o.id,
      id: o.id,
      title: o.title,
      metric: o.metric ?? '',
      unit: o.unit ?? '',
      baseline: asText(o.baseline),
      target: asText(o.target),
      current: asText(o.current),
    })),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  if (missing) return null

  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) =>
    setValues((x) => ({ ...x, [k]: v }))
  const setRow = (key: string, patch: Partial<OutcomeRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError(undefined)
    try {
      await saveObjective(
        {
          title: values.title,
          description: optional(values.description),
          status: values.status,
          targetDate: optional(values.targetDate),
          outcomes: rows.map((r) => ({
            id: r.id,
            title: r.title,
            metric: optional(r.metric),
            unit: optional(r.unit),
            baseline: toNumber(r.baseline),
            target: toNumber(r.target),
            current: toNumber(r.current),
          })),
        },
        id,
      )
      toast.success(id ? 'Objective saved' : 'Objective created', values.title.trim())
      close()
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
        <DrawerTitle>{id ? 'Edit objective' : 'New objective'}</DrawerTitle>
        <DrawerDescription>
          An outcome you want, and how you will know you reached it.
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
        <Field label="Objective" error={errors.title}>
          {(c) => (
            <Input
              {...c}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
              maxLength={200}
              autoComplete="off"
              placeholder="Find the first 25 people who care"
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
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Status" error={errors.status}>
            {(c) => (
              <Select
                {...c}
                value={values.status}
                onChange={(e) => set('status', e.target.value as Objective['status'])}
              >
                {OBJECTIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {OBJECTIVE_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Target date" note="optional" error={errors.targetDate}>
            {(c) => (
              <Input
                {...c}
                type="date"
                value={values.targetDate}
                onChange={(e) => set('targetDate', e.target.value)}
              />
            )}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-title font-semibold text-foreground">
            Measurable outcomes
          </legend>
          <p className="text-body text-muted-foreground">
            How will you know it worked? Name what you will measure, where it started, where it
            should get to and where it is now.
          </p>
          {rows.map((r, index) => {
            const err = (field: string) => errors[`outcomes.${index}.${field}`]
            const preview =
              [r.baseline, r.target, r.current].every(
                (v) => v.trim() !== '' && Number.isFinite(Number(v)),
              ) && Number(r.target) !== Number(r.baseline)
                ? asPercent(
                    outcomeProgress({
                      baseline: Number(r.baseline),
                      target: Number(r.target),
                      current: Number(r.current),
                    }),
                  )
                : undefined
            return (
              <div
                key={r.key}
                role="group"
                aria-label={`Outcome ${index + 1}`}
                className="flex flex-col gap-4 rounded-input border bg-surface p-4"
              >
                <Field label="Outcome" error={err('title')}>
                  {(c) => (
                    <Input
                      {...c}
                      value={r.title}
                      onChange={(e) => setRow(r.key, { title: e.target.value })}
                      maxLength={200}
                      autoComplete="off"
                      placeholder="People use it every week"
                    />
                  )}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Success metric" note="optional" error={err('metric')}>
                    {(c) => (
                      <Input
                        {...c}
                        value={r.metric}
                        onChange={(e) => setRow(r.key, { metric: e.target.value })}
                        autoComplete="off"
                        placeholder="Weekly active users"
                      />
                    )}
                  </Field>
                  <Field label="Unit" note="optional" error={err('unit')}>
                    {(c) => (
                      <Input
                        {...c}
                        value={r.unit}
                        onChange={(e) => setRow(r.key, { unit: e.target.value })}
                        autoComplete="off"
                        placeholder="users"
                      />
                    )}
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Baseline" error={err('baseline')}>
                    {(c) => (
                      <Input
                        {...c}
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={r.baseline}
                        onChange={(e) => setRow(r.key, { baseline: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Target" error={err('target')}>
                    {(c) => (
                      <Input
                        {...c}
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={r.target}
                        onChange={(e) => setRow(r.key, { target: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label="Current" error={err('current')}>
                    {(c) => (
                      <Input
                        {...c}
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={r.current}
                        onChange={(e) => setRow(r.key, { current: e.target.value })}
                      />
                    )}
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-4">
                  {preview !== undefined ? (
                    <div className="flex flex-1 items-center gap-3">
                      <Progress
                        value={preview}
                        label={`Progress for outcome ${index + 1}`}
                        className="max-w-48"
                      />
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {preview}% of the way
                      </span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    aria-label={`Remove outcome ${index + 1}`}
                  >
                    <Trash2 aria-hidden /> Remove
                  </Button>
                </div>
              </div>
            )
          })}
          <div>
            <Button variant="outline" onClick={() => setRows((rs) => [...rs, blankRow()])}>
              <Plus aria-hidden /> Add an outcome
            </Button>
          </div>
        </fieldset>
      </DrawerBody>
      <DrawerFooter className="justify-between">
        {id ? (
          <Button
            variant="destructive"
            onClick={() => askDelete('objective', id)}
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
            {id ? 'Save changes' : 'Create objective'}
          </Button>
        </div>
      </DrawerFooter>
    </form>
  )
}
