import { useMemo, useState } from 'react'
import { Alert } from '@/components/ui/alert'
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
import { pluralise } from '@/lib/format'
import { toStorageError } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { templateFromRoadmap } from '@/templates/capture'
import { saveRoadmapAsTemplate } from './actions'

/** Turn one of your roadmaps into a reusable template. It copies the structure; your product is not changed. */
export function SaveTemplateForm({ roadmapId: preset }: { roadmapId?: string }) {
  const plan = usePlanningStore()
  const { closeSaveTemplate } = useItemDrawer()
  const roadmaps = plan.roadmaps
  const [roadmapId, setRoadmapId] = useState(preset ?? roadmaps[0]?.id ?? '')
  const roadmap = roadmaps.find((r) => r.id === roadmapId)
  const [name, setName] = useState(roadmap ? `${roadmap.name} template` : '')
  const [summary, setSummary] = useState('')
  const [bestFor, setBestFor] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  /** What the template would contain, worked out live so the person knows what they are saving. */
  const preview = useMemo(() => {
    if (!roadmap) return undefined
    try {
      return templateFromRoadmap(
        {
          product: {},
          roadmap,
          objectives: plan.objectives,
          initiatives: plan.initiatives,
          features: plan.features,
          tags: plan.tags,
          milestones: plan.milestones,
          dependencies: plan.dependencies,
        },
        { name: 'x', summary: 'x', bestFor: 'x' },
      )
    } catch {
      return undefined
    }
  }, [
    roadmap,
    plan.objectives,
    plan.initiatives,
    plan.features,
    plan.tags,
    plan.milestones,
    plan.dependencies,
  ])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!roadmap) return
    setSaving(true)
    setErrors({})
    setFormError(undefined)
    try {
      const saved = await saveRoadmapAsTemplate(roadmap.id, { name, summary, bestFor, note })
      toast.success('Template saved', saved.name)
      closeSaveTemplate()
    } catch (err) {
      const se = toStorageError(err)
      if (se.code === 'VALIDATION') {
        setErrors(se.fieldErrors)
        if (!se.fieldErrors.name && !se.fieldErrors.summary && !se.fieldErrors.bestFor)
          setFormError(se.message)
      } else setFormError(`${se.message} ${se.recovery}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>Save as a template</DrawerTitle>
        <DrawerDescription>
          Keep this roadmap’s structure to start future products from.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-6">
        {roadmaps.length === 0 ? (
          <Alert tone="info" title="You have no roadmap to save yet">
            Make a roadmap in this product first, then come back.
          </Alert>
        ) : (
          <>
            {formError && (
              <p
                role="alert"
                className="rounded-input bg-destructive-soft px-4 py-3 text-body text-destructive"
              >
                {formError}
              </p>
            )}
            <Field label="Roadmap to save">
              {(c) => (
                <Select
                  {...c}
                  value={roadmapId}
                  onChange={(e) => {
                    setRoadmapId(e.target.value)
                    const r = roadmaps.find((x) => x.id === e.target.value)
                    if (r && (!name || name.endsWith(' template'))) setName(`${r.name} template`)
                  }}
                >
                  {roadmaps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Template name" error={errors.name}>
              {(c) => (
                <Input
                  {...c}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  maxLength={80}
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label="What it is for" error={errors.summary} hint="One or two sentences.">
              {(c) => (
                <Textarea
                  {...c}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={2}
                />
              )}
            </Field>
            <Field label="Who it suits" error={errors.bestFor}>
              {(c) => (
                <Input
                  {...c}
                  value={bestFor}
                  onChange={(e) => setBestFor(e.target.value)}
                  autoComplete="off"
                />
              )}
            </Field>
            <Field
              label="How to plan with it"
              note="optional"
              hint="A tip shown with the template, such as how often to review it."
            >
              {(c) => (
                <Textarea {...c} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              )}
            </Field>
            {preview && (
              <div className="rounded-input border bg-surface p-4">
                <p className="text-body font-semibold text-foreground">What will be saved</p>
                <p className="mt-1 text-body tabular-nums">
                  {pluralise(preview.objectives.length, 'objective')},{' '}
                  {pluralise(preview.initiatives.length, 'initiative')},{' '}
                  {pluralise(
                    preview.initiatives.reduce((n, i) => n + i.features.length, 0),
                    'feature',
                  )}
                  , {pluralise(preview.milestones.length, 'milestone')}
                </p>
                <p className="mt-2 text-caption text-muted-foreground">
                  Titles, descriptions, statuses, priorities, estimates, confidence, links, dates
                  (as months from the start) and how the roadmap is set up. Descriptions, tags and
                  link notes come with it. Owners are left out. This makes a copy: your product is
                  not changed.
                </p>
              </div>
            )}
          </>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={closeSaveTemplate} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving} disabled={!roadmap}>
          Save template
        </Button>
      </DrawerFooter>
    </form>
  )
}
