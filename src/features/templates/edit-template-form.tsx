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
import { Input, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { toStorageError } from '@/storage'
import { useItemDrawer } from '@/store/drawer-store'
import { useTemplateStore } from '@/store/template-store'
import { updateTemplateDetails } from './actions'

/** Change a custom template's name and descriptions. Its roadmap content is fixed; duplicate it to start another. */
export function EditTemplateForm({ id }: { id: string }) {
  const template = useTemplateStore((s) => s.custom.find((t) => t.id === id))
  const { closeEditTemplate } = useItemDrawer()
  const missing = !template
  useEffect(() => {
    if (missing) closeEditTemplate()
  }, [missing, closeEditTemplate])

  const [name, setName] = useState(template?.name ?? '')
  const [summary, setSummary] = useState(template?.summary ?? '')
  const [bestFor, setBestFor] = useState(template?.bestFor ?? '')
  const [note, setNote] = useState(template?.structure.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  if (!template) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await updateTemplateDetails(id, { name, summary, bestFor, note })
      toast.success('Template saved', name.trim())
      closeEditTemplate()
    } catch (err) {
      const se = toStorageError(err)
      if (se.code === 'VALIDATION') setErrors(se.fieldErrors)
      else toast.error('Could not save', se.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>Edit template</DrawerTitle>
        <DrawerDescription>
          Its objectives, initiatives and features stay as they were saved.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-6">
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
        <Field label="What it is for" error={errors.summary}>
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
        <Field label="How to plan with it" error={errors['structure.note']}>
          {(c) => (
            <Textarea {...c} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          )}
        </Field>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={closeEditTemplate} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save changes
        </Button>
      </DrawerFooter>
    </form>
  )
}
