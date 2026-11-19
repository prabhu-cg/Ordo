import { useMemo } from 'react'
import type { TemplateDefinition } from '@/domain'
import { TEMPLATES } from '@/templates'
import { useTemplateStore } from '@/store/template-store'

export interface TemplateEntry {
  template: TemplateDefinition
  /** Built-in templates hold sample data; a person's own template is their own structure. */
  builtIn: boolean
}

/** Every template on offer: the built-in six, then the person's own. */
export function useTemplates() {
  const custom = useTemplateStore((s) => s.custom)
  const loaded = useTemplateStore((s) => s.loaded)
  return useMemo(() => {
    const all: TemplateEntry[] = [
      ...TEMPLATES.map((template) => ({ template, builtIn: true })),
      ...custom.map((t) => ({ template: t as TemplateDefinition, builtIn: false })),
    ]
    return {
      all,
      custom,
      loaded,
      find: (id: string | null | undefined) => all.find((e) => e.template.id === id),
    }
  }, [custom, loaded])
}
