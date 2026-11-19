import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RoadmapViewer } from '@/components/roadmap/roadmap-preview'
import { PageHeader } from '@/components/shell/page-header'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/input'
import { usePageTitle } from '@/features/marketing/use-page-title'
import {
  DEFAULT_SAMPLE_TEMPLATE_ID,
  TEMPLATES,
  describeTemplate,
  getTemplate,
  resolveTemplate,
} from '@/templates'

/**
 * A read-only sample. It renders a template through the same view components a saved product uses,
 * but it is never written to storage: nothing here can change a template or the user's products.
 */
export function ExampleContent() {
  const [params, setParams] = useSearchParams()
  const template = getTemplate(params.get('template')) ?? getTemplate(DEFAULT_SAMPLE_TEMPLATE_ID)!
  usePageTitle('Example roadmap')
  const bundle = useMemo(
    () => resolveTemplate(template, { product: { name: template.name } }),
    [template],
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Example roadmap"
        description="Look around a finished plan. It is a read-only sample, so nothing you do here is saved or changes your own products."
        actions={
          <Button asChild variant="primary">
            <Link to={`/app/new?template=${template.id}`}>Use this template</Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Sample" className="w-full sm:max-w-sm" hint={describeTemplate(template)}>
          {(c) => (
            <Select
              {...c}
              value={template.id}
              onChange={(e) => setParams({ template: e.target.value }, { replace: true })}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className="max-w-prose text-body text-muted-foreground">
        {template.summary} Select any initiative to see its details.
      </p>
      <RoadmapViewer key={template.id} bundle={bundle} selectable />
      <Alert tone="info" title="This is a sample" className="max-w-3xl">
        Using the template copies it into a new product of your own. The original stays exactly as
        it is.
      </Alert>
    </div>
  )
}

/** The same sample inside the public site's layout. */
export function PublicExamplePage() {
  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <ExampleContent />
      </div>
    </div>
  )
}
