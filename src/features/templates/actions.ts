import { toast } from '@/components/ui/toast'
import type { TemplateDefinition } from '@/domain'
import { templateFromRoadmap, type CaptureInput } from '@/templates/capture'
import { getStorage, toStorageError } from '@/storage'
import { usePlanningStore } from '@/store/planning-store'
import { useTemplateStore } from '@/store/template-store'

const reload = () => useTemplateStore.getState().load()
const service = () => getStorage().templateService

/**
 * Save a roadmap's structure as a template. It only reads the plan and writes a separate template record, so the
 * product it came from is left exactly as it was. Throws, so the form can show what is wrong.
 */
export async function saveRoadmapAsTemplate(roadmapId: string, input: CaptureInput) {
  const plan = usePlanningStore.getState()
  const roadmap = plan.roadmaps.find((r) => r.id === roadmapId)
  if (!roadmap) throw new Error('That roadmap no longer exists.')
  const product = (await getStorage().products.get(plan.productId ?? '')) ?? undefined
  const content = templateFromRoadmap(
    {
      product: { category: product?.category, planningHorizon: product?.planningHorizon },
      roadmap,
      objectives: plan.objectives,
      initiatives: plan.initiatives,
      features: plan.features,
      tags: plan.tags,
      milestones: plan.milestones,
      dependencies: plan.dependencies,
    },
    input,
  )
  const saved = await service().create(content, `Roadmap “${roadmap.name}”`)
  await reload()
  return saved
}

/** A copy you can keep and use: of a built-in (pass it) or of one of your own (pass its id). */
export async function duplicateTemplate(source: TemplateDefinition | string) {
  try {
    const copy = await service().duplicate(source)
    await reload()
    toast.success('Template duplicated', copy.name)
    return copy
  } catch (e) {
    toast.error('Could not duplicate', toStorageError(e).message)
    return undefined
  }
}

export async function updateTemplateDetails(
  id: string,
  fields: { name: string; summary: string; bestFor: string; note?: string },
) {
  await service().update(id, fields)
  await reload()
}

export async function deleteTemplate(id: string, name: string) {
  try {
    await service().delete(id)
    await reload()
    toast.success('Template deleted', name, {
      label: 'Undo',
      onClick: () =>
        void service()
          .restore(id)
          .then(reload)
          .catch((e) => toast.error('Could not undo', toStorageError(e).message)),
    })
    return true
  } catch (e) {
    toast.error('Could not delete', toStorageError(e).message)
    return false
  }
}
