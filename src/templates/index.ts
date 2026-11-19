import {
  featureDevelopment,
  productRedesign,
  quarterlyProduct,
  saasProduct,
  soloFounder,
  startupMvp,
} from './definitions'
import type { TemplateDefinition } from './types'

/** The built-in templates, in the order they are offered. */
export const TEMPLATES: readonly TemplateDefinition[] = [
  startupMvp,
  saasProduct,
  quarterlyProduct,
  featureDevelopment,
  productRedesign,
  soloFounder,
]
export const DEFAULT_SAMPLE_TEMPLATE_ID = startupMvp.id

export const getTemplate = (id: string | null | undefined): TemplateDefinition | undefined =>
  TEMPLATES.find((t) => t.id === id)

export { resolveTemplate, templateHorizonMonths } from './resolve'
export type { TemplateDefinition } from './types'

/** Short, true description of what a template contains. */
export function describeTemplate(t: TemplateDefinition): string {
  const features = t.initiatives.reduce((n, i) => n + i.features.length, 0)
  return `${t.objectives.length} objectives · ${t.initiatives.length} initiatives · ${features} features`
}
