import { useState } from 'react'
import {
  PLANNING_HORIZONS,
  PRODUCT_CATEGORIES,
  type PlanningHorizon,
  type Product,
  type ProductCategory,
} from '@/domain'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { CATEGORY_LABELS, HORIZON_LABELS } from '@/lib/labels'
import { toStorageError } from '@/storage'
import { useWorkspaceStore, type ProductPatch } from '@/store/workspace-store'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
}

type Values = {
  name: string
  tagline: string
  description: string
  vision: string
  targetAudience: string
  category: ProductCategory | ''
  planningHorizon: PlanningHorizon | ''
}

const fromProduct = (p: Product): Values => ({
  name: p.name,
  tagline: p.tagline ?? '',
  description: p.description ?? '',
  vision: p.vision ?? '',
  targetAudience: p.targetAudience ?? '',
  category: p.category ?? '',
  planningHorizon: p.planningHorizon ?? '',
})

/** Empty optional text means "not set": never persist empty strings. */
const optional = (s: string) => (s.trim() === '' ? undefined : s)

/** Editing a product's details. Creating one is the guided flow at /app/new. */
export function ProductFormDrawer({ open, onOpenChange, product }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent size="lg" aria-describedby="product-form-description">
        {open && product && (
          <ProductForm key={product.id} product={product} onClose={() => onOpenChange(false)} />
        )}
      </DrawerContent>
    </Drawer>
  )
}

function ProductForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const updateProduct = useWorkspaceStore((s) => s.updateProduct)
  const [values, setValues] = useState<Values>(() => fromProduct(product))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const bind = (key: 'name' | 'tagline' | 'description' | 'vision' | 'targetAudience') => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError(undefined)
    const patch: ProductPatch = {
      name: values.name,
      tagline: optional(values.tagline),
      description: optional(values.description),
      vision: optional(values.vision),
      targetAudience: optional(values.targetAudience),
      category: values.category || undefined,
      planningHorizon: values.planningHorizon || undefined,
    }
    try {
      await updateProduct(product.id, patch)
      toast.success('Product saved', values.name.trim())
      onClose()
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
        <DrawerTitle>Edit product</DrawerTitle>
        <DrawerDescription id="product-form-description">
          Changes are saved on this device.
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
        <Field label="Product name" error={errors.name}>
          {(c) => <Input {...c} {...bind('name')} autoFocus maxLength={200} autoComplete="off" />}
        </Field>
        <Field
          label="Short description"
          note="optional"
          error={errors.tagline}
          hint="One line you would say out loud."
        >
          {(c) => <Input {...c} {...bind('tagline')} autoComplete="off" />}
        </Field>
        <Field label="Product category" note="optional" error={errors.category}>
          {(c) => (
            <Select
              {...c}
              value={values.category}
              onChange={(e) =>
                setValues((v) => ({ ...v, category: e.target.value as ProductCategory | '' }))
              }
            >
              <option value="">Not set</option>
              {PRODUCT_CATEGORIES.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Details" note="optional" error={errors.description}>
          {(c) => <Textarea {...c} {...bind('description')} rows={3} />}
        </Field>
        <Field label="Target audience" note="optional" error={errors.targetAudience}>
          {(c) => <Textarea {...c} {...bind('targetAudience')} rows={2} />}
        </Field>
        <Field
          label="Product vision"
          note="optional"
          error={errors.vision}
          hint="What is true in a few years if this works?"
        >
          {(c) => <Textarea {...c} {...bind('vision')} rows={3} />}
        </Field>
        <Field label="Planning horizon" note="optional" error={errors.planningHorizon}>
          {(c) => (
            <Select
              {...c}
              value={values.planningHorizon}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  planningHorizon: e.target.value as PlanningHorizon | '',
                }))
              }
            >
              <option value="">Not set</option>
              {PLANNING_HORIZONS.map((k) => (
                <option key={k} value={k}>
                  {HORIZON_LABELS[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save changes
        </Button>
      </DrawerFooter>
    </form>
  )
}
