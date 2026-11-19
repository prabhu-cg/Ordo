import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/input'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { duplicateTemplate } from '@/features/templates/actions'
import { TemplatePreview } from '@/features/templates/template-preview'
import { useTemplates } from '@/features/templates/use-templates'
import { DEFAULT_SAMPLE_TEMPLATE_ID, TEMPLATES, describeTemplate } from '@/templates'

/**
 * Explore any template in a throwaway preview: nothing here is saved or changes your own products.
 * In the app the list also includes your own templates; on the public site it is the built-in six.
 */
export function ExampleContent({ app = false }: { app?: boolean }) {
  const [params, setParams] = useSearchParams()
  const { all, find } = useTemplates()
  const options = app ? all : all.filter((e) => e.builtIn)
  const entry = find(params.get('template')) ??
    options.find((e) => e.template.id === DEFAULT_SAMPLE_TEMPLATE_ID) ?? {
      template: TEMPLATES[0]!,
      builtIn: true,
    }
  const { template, builtIn } = entry
  usePageTitle('Example roadmap')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Example roadmap"
        description="Look around a finished plan and try it out. It is a preview, so nothing you do here is saved or changes your own products."
        actions={
          <>
            {app && (
              <Button
                variant="outline"
                onClick={() => void duplicateTemplate(builtIn ? template : template.id)}
              >
                Duplicate template
              </Button>
            )}
            <Button asChild variant="primary">
              <Link to={`/app/new?template=${template.id}`}>Use this template</Link>
            </Button>
          </>
        }
      />
      <Field label="Template" className="w-full sm:max-w-sm" hint={describeTemplate(template)}>
        {(c) => (
          <Select
            {...c}
            value={template.id}
            onChange={(e) => setParams({ template: e.target.value }, { replace: true })}
          >
            {options.map((e) => (
              <option key={e.template.id} value={e.template.id}>
                {e.template.name}
                {e.builtIn ? '' : ' (yours)'}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <p className="max-w-prose text-body text-muted-foreground">
        {template.summary} <span className="text-foreground">{template.bestFor}</span> Select a card
        for its details.
      </p>
      <TemplatePreview key={template.id} template={template} sample={builtIn} />
    </div>
  )
}

/** The same preview inside the public site's layout. */
export function PublicExamplePage() {
  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <ExampleContent />
      </div>
    </div>
  )
}
