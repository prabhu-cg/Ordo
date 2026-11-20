import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Input, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import {
  PLANNING_HORIZONS,
  PRODUCT_CATEGORIES,
  productSchema,
  type PlanningHorizon,
  type ProductCategory,
} from '@/domain'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { CATEGORY_LABELS, HORIZON_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { toStorageError } from '@/storage'
import { useTemplates } from '@/features/templates/use-templates'
import { describeTemplate, resolveTemplate } from '@/templates'
import { useWorkspaceStore, type ProductInput } from '@/store/workspace-store'

interface Values {
  templateId: string // '' means from scratch
  name: string
  tagline: string
  category: ProductCategory | ''
  targetAudience: string
  vision: string
  horizon: PlanningHorizon | ''
}

const STEPS = ['Starting point', 'About your product', 'Direction'] as const
/** Which step owns each field, so a validation error can send you back to it. */
const FIELD_STEP: Record<string, number> = {
  name: 1,
  tagline: 1,
  category: 1,
  targetAudience: 2,
  vision: 2,
  planningHorizon: 2,
}

const optional = (s: string) => (s.trim() === '' ? undefined : s)

const Backdrop = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
)

/**
 * Creating a product opens as a drawer, like every other create and edit surface. It keeps its own address so
 * links such as `/app/new?template=...` still work; the dashboard shows behind it, and closing returns you to
 * wherever you came from.
 */
export function NewProductPage() {
  usePageTitle('New product')
  const navigate = useNavigate()
  const location = useLocation()
  const leave = () => (location.key !== 'default' ? navigate(-1) : navigate('/app'))
  return (
    <>
      <Suspense fallback={null}>
        <div aria-hidden inert>
          <Backdrop />
        </div>
      </Suspense>
      <Drawer open onOpenChange={(o) => !o && leave()}>
        <DrawerContent size="lg" aria-describedby="new-product-description">
          <CreateProduct onLeave={leave} />
        </DrawerContent>
      </Drawer>
    </>
  )
}

function CreateProduct({ onLeave }: { onLeave: () => void }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { createProduct, createProductFromBundle } = useWorkspaceStore()

  const { all, find } = useTemplates()
  const requested = params.get('template')
  const initialTemplate = find(requested)?.template
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Values>({
    templateId: initialTemplate?.id ?? '',
    name: '',
    tagline: '',
    category: initialTemplate?.category ?? '',
    targetAudience: '',
    vision: '',
    horizon: initialTemplate?.structure.horizon ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const finished = useRef(false)
  useEffect(() => {
    // A template of your own named in the address may load a moment after the page does.
    const t = requested ? find(requested)?.template : undefined
    if (t && values.templateId === '' && step === 0 && !dirty) chooseTemplate(t.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, all.length])

  const entry = find(values.templateId)
  const template = entry?.template
  const dirty = [values.name, values.tagline, values.targetAudience, values.vision].some(
    (v) => v.trim() !== '',
  )
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !finished.current && currentLocation.pathname !== nextLocation.pathname,
  )

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value }))
  const bind = (key: 'name' | 'tagline' | 'targetAudience' | 'vision') => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value),
  })

  function chooseTemplate(id: string) {
    const t = find(id)?.template
    setValues((v) => ({
      ...v,
      templateId: id,
      category: t?.category ?? v.category,
      horizon: t?.structure.horizon ?? v.horizon,
    }))
  }

  function validateStep(n: number): boolean {
    if (n === 1) {
      const result = productSchema.shape.name.safeParse(values.name)
      if (!result.success) {
        setErrors({ name: result.error.issues[0]?.message ?? 'A name is required' })
        return false
      }
    }
    setErrors({})
    return true
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep(step)) return
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }
    setSaving(true)
    setFormError(undefined)
    const product: ProductInput = {
      name: values.name,
      tagline: optional(values.tagline),
      category: values.category || undefined,
      targetAudience: optional(values.targetAudience),
      vision: optional(values.vision),
      planningHorizon: values.horizon || undefined,
    }
    try {
      if (template)
        await createProductFromBundle(
          resolveTemplate(template, { product, sample: entry!.builtIn }),
        )
      else await createProduct(product)
      finished.current = true
      toast.success('Product created', values.name.trim())
      navigate('/app/workspace')
    } catch (err) {
      const se = toStorageError(err)
      if (se.code === 'VALIDATION') {
        setErrors(se.fieldErrors)
        const target = Math.min(...Object.keys(se.fieldErrors).map((k) => FIELD_STEP[k] ?? 1))
        setStep(Number.isFinite(target) ? target : 1)
      } else {
        setFormError(`${se.message} ${se.recovery}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>Create a product</DrawerTitle>
        <DrawerDescription id="new-product-description">
          Three short steps. Everything except the name is optional and can be changed later.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-8">
        <nav aria-label="Setup progress">
          <ol className="flex flex-wrap gap-1.5">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? 'step' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 text-body font-medium',
                  i === step
                    ? 'bg-primary-soft font-semibold text-primary-text'
                    : 'text-muted-foreground',
                )}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className="ml-1.5">{label}</span>
              </li>
            ))}
          </ol>
        </nav>

        {formError && (
          <Alert tone="destructive" title="Could not create the product">
            {formError}
          </Alert>
        )}

        {step === 0 && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-title font-semibold text-foreground">
              How do you want to start?
            </legend>
            {[
              {
                id: '',
                name: 'Start from scratch',
                summary: 'A blank product. Add objectives, initiatives and features yourself.',
                counts: '',
              },
              ...all.map((e) => ({
                id: e.template.id,
                name: e.template.name,
                summary: e.template.summary,
                counts: describeTemplate(e.template),
                own: !e.builtIn,
              })),
            ].map((o) => (
              <label
                key={o.id || 'scratch'}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-input border p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40',
                  values.templateId === o.id
                    ? 'border-primary-text bg-primary-soft'
                    : 'hover:bg-sand',
                )}
              >
                <input
                  type="radio"
                  name="start"
                  className="mt-1 size-4 accent-[var(--primary-text)]"
                  checked={values.templateId === o.id}
                  onChange={() => chooseTemplate(o.id)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-body font-semibold text-foreground">
                    {o.name}
                    {'own' in o && o.own && <Badge variant="soft">Yours</Badge>}
                  </span>
                  <span className="mt-0.5 block text-body text-muted-foreground">{o.summary}</span>
                  {o.counts && (
                    <span className="mt-1 block text-caption text-muted-foreground tabular-nums">
                      {o.counts}
                    </span>
                  )}
                </span>
              </label>
            ))}
            <p className="text-caption text-muted-foreground">
              A template is copied into your new product. The original is never changed, and nothing
              is added to your other products.{' '}
              {template && (
                <Link
                  to={`/app/example?template=${template.id}`}
                  className="font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
                >
                  Preview {template.name}
                </Link>
              )}
            </p>
          </fieldset>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <Field label="Product name" error={errors.name}>
              {(c) => (
                <Input {...c} {...bind('name')} autoFocus maxLength={200} autoComplete="off" />
              )}
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
                  onChange={(e) => set('category', e.target.value as ProductCategory | '')}
                >
                  <option value="">Choose a category</option>
                  {PRODUCT_CATEGORIES.map((k) => (
                    <option key={k} value={k}>
                      {CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <Field
              label="Target audience"
              note="optional"
              error={errors.targetAudience}
              hint="Who is it for, and what are they trying to do?"
            >
              {(c) => <Textarea {...c} {...bind('targetAudience')} rows={3} autoFocus />}
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
                  value={values.horizon}
                  onChange={(e) => set('horizon', e.target.value as PlanningHorizon | '')}
                >
                  <option value="">Choose a horizon</option>
                  {PLANNING_HORIZONS.map((k) => (
                    <option key={k} value={k}>
                      {HORIZON_LABELS[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className="text-caption text-muted-foreground">
              {template ? `Starting from the ${template.name} template.` : 'Starting from scratch.'}
            </p>
          </div>
        )}
      </DrawerBody>
      <DrawerFooter className="justify-between">
        <Button variant="ghost" onClick={onLeave} disabled={saving}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setErrors({})
              setStep(step - 1)
            }}
            disabled={step === 0 || saving}
          >
            Back
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {step < STEPS.length - 1 ? 'Next' : 'Create product'}
          </Button>
        </div>
      </DrawerFooter>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="Discard this product?"
        description="You have started filling this in. If you leave now, what you typed is lost."
        confirmLabel="Discard and leave"
        destructive
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
      />
    </form>
  )
}
