import type { TemplateDefinition, TemplateRecord } from '@/domain'
import { StorageError, guard } from './errors'
import type { Repositories } from './repositories'

/** A template's content without who owns it: what a person fills in, or what is copied from a built-in. */
export type TemplateContent = Omit<TemplateDefinition, 'id'>

/**
 * Custom templates: the person's own reusable roadmap structures. A template is its own record. Saving one copies
 * from a roadmap or from another template, and editing or deleting one never touches the plan it came from.
 */
export function createTemplateService(r: Repositories) {
  const live = (rows: TemplateRecord[]) => rows.filter((t) => !t.deletedAt)

  async function require(id: string) {
    const t = await r.templates.get(id)
    if (!t) throw new StorageError('NOT_FOUND', 'That template no longer exists.')
    return t
  }

  return {
    /** Newest first. */
    list: () =>
      guard(async () =>
        live(await r.templates.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      ),

    /** Save content as a new custom template. `basedOn` names what it was copied from, if anything. */
    create: (content: TemplateContent, basedOn?: string) =>
      guard(() => r.templates.create({ ...content, basedOn })),

    /** Make an editable copy of any template: a built-in (pass its content) or one of your own (pass its id). */
    duplicate: (source: TemplateContent | string) =>
      guard(async () => {
        const content: TemplateContent = typeof source === 'string' ? await require(source) : source
        const {
          name,
          summary,
          bestFor,
          category,
          structure,
          tags,
          objectives,
          initiatives,
          milestones,
        } = content
        const copyName = `${name} (copy)`.slice(0, 80)
        // structuredClone so the copy shares nothing with what it was made from.
        return r.templates.create(
          structuredClone({
            name: copyName,
            summary,
            bestFor,
            category,
            structure,
            tags,
            objectives,
            initiatives,
            milestones,
            basedOn: name,
          }),
        )
      }),

    /** Change a template's words. Its roadmap content is fixed once saved; duplicate it to start a different one. */
    update: (
      id: string,
      fields: { name: string; summary: string; bestFor: string; note?: string },
    ) =>
      guard(async () => {
        const current = await require(id)
        return r.templates.update(id, {
          name: fields.name,
          summary: fields.summary,
          bestFor: fields.bestFor,
          structure: { ...current.structure, note: fields.note ?? current.structure.note },
        })
      }),

    delete: (id: string) =>
      guard(async () => {
        await require(id)
        await r.templates.remove(id)
      }),
    restore: (id: string) => guard(() => r.templates.restore(id)),
  }
}

export type TemplateService = ReturnType<typeof createTemplateService>
