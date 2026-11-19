import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { templateDefinitionSchema } from '@/domain'
import { freshStorage } from '@/storage/helpers.test-util'
import type { Storage } from '@/storage'
import { templateFromRoadmap, type PlanSnapshot } from './capture'
import { getTemplate, resolveTemplate } from './index'
import { stampBundle } from './records'

const anchor = new Date(Date.UTC(2026, 10, 19))

function snapshotOf(id: string): PlanSnapshot {
  const b = resolveTemplate(getTemplate(id)!, { product: { name: 'Source' }, anchor })
  const r = stampBundle(b)
  return {
    product: { category: b.product.category, planningHorizon: b.product.planningHorizon },
    ...r,
  }
}

describe("saving a roadmap's structure as a template", () => {
  it('captures objectives, initiatives, features, priorities, estimates, links, milestones and the planning structure', () => {
    const plan = snapshotOf('saas-product')
    const t = templateFromRoadmap(plan, {
      name: 'My SaaS plan',
      summary: 'Our yearly plan',
      bestFor: 'Us',
    })
    expect(templateDefinitionSchema.safeParse({ id: 'x', ...t }).success).toBe(true)
    const source = getTemplate('saas-product')!
    expect(t.objectives.map((o) => o.title)).toEqual(source.objectives.map((o) => o.title))
    expect(t.initiatives.map((i) => i.title)).toEqual(source.initiatives.map((i) => i.title))
    expect(t.initiatives.flatMap((i) => i.features.map((f) => f.title))).toEqual(
      source.initiatives.flatMap((i) => i.features.map((f) => f.title)),
    )
    expect(t.structure).toMatchObject({
      planningMode: 'flexible',
      defaultView: 'now-next-later',
      horizon: '12-months',
    })
    expect(t.category).toBe('saas')
    expect(t.milestones).toHaveLength(2)
    const onboarding = t.initiatives.find((i) => i.title === 'Onboarding revamp')!
    expect(onboarding).toMatchObject({
      priority: 'critical',
      impact: 'high',
      effort: 'medium',
      confidence: 'committed',
      lane: 'now',
    })
    expect(onboarding.links).toEqual([
      { to: t.initiatives.find((i) => i.title === 'In-app guidance')!.key, kind: 'blocks' },
    ])
  })

  it('round trips: using the captured template gives the same shape of plan', () => {
    const t = templateFromRoadmap(snapshotOf('product-redesign'), {
      name: 'Copy',
      summary: 's',
      bestFor: 'b',
    })
    const again = resolveTemplate({ id: 'x', ...t }, { product: { name: 'New' }, anchor })
    const original = resolveTemplate(getTemplate('product-redesign')!, {
      product: { name: 'Old' },
      anchor,
    })
    expect(again.initiatives.map((i) => [i.title, i.startDate, i.endDate, i.priority])).toEqual(
      original.initiatives.map((i) => [i.title, i.startDate, i.endDate, i.priority]),
    )
    expect(again.dependencies).toHaveLength(original.dependencies.length)
    expect(again.milestones.map((m) => m.date)).toEqual(original.milestones.map((m) => m.date))
  })

  it('stores dates as offsets, so the template can start in any month', () => {
    const t = templateFromRoadmap(snapshotOf('startup-mvp'), {
      name: 'T',
      summary: 's',
      bestFor: 'b',
    })
    expect(t.initiatives[0]!.months).toEqual([0, 1])
    const later = resolveTemplate(
      { id: 'x', ...t },
      { product: { name: 'X' }, anchor: new Date(Date.UTC(2027, 5, 1)) },
    )
    expect(later.initiatives[0]!.startDate).toBe('2027-06-01')
  })

  it('leaves out owners, and does not carry sample-data labels', () => {
    const plan = snapshotOf('solo-founder')
    plan.initiatives[0]!.owner = 'Sam'
    const t = templateFromRoadmap(plan, { name: 'T', summary: 's', bestFor: 'b' })
    expect(JSON.stringify(t)).not.toContain('Sam')
    const product = resolveTemplate(
      { id: 'x', ...t },
      { product: { name: 'X' }, anchor, sample: false },
    )
    expect(product.product.sampleData).toBeUndefined()
  })

  it('only takes what is on the roadmap, ignores archived items, and keeps undated items undated', () => {
    const plan = snapshotOf('startup-mvp')
    plan.roadmap.entries = plan.roadmap.entries.slice(0, 3)
    plan.initiatives[0]!.deletedAt = '2026-01-01T00:00:00.000Z'
    plan.initiatives[1]!.startDate = undefined
    plan.initiatives[1]!.endDate = undefined
    const t = templateFromRoadmap(plan, { name: 'T', summary: 's', bestFor: 'b' })
    expect(t.initiatives).toHaveLength(2)
    expect(t.initiatives[0]!.months).toBeUndefined()
  })

  it('does not change the plan it was taken from', () => {
    const plan = snapshotOf('quarterly')
    const before = JSON.stringify(plan)
    templateFromRoadmap(plan, { name: 'T', summary: 's', bestFor: 'b' })
    expect(JSON.stringify(plan)).toBe(before)
  })

  it('copes with an empty roadmap', () => {
    const plan = snapshotOf('quarterly')
    plan.roadmap.entries = []
    const t = templateFromRoadmap(plan, { name: 'Empty', summary: 's', bestFor: 'b' })
    expect(t.initiatives).toEqual([])
  })
})

describe('custom templates in storage', () => {
  let s: Storage
  beforeEach(async () => {
    s = await freshStorage()
  })
  afterEach(async () => {
    await s.destroy()
  })

  const content = () =>
    templateFromRoadmap(snapshotOf('feature-development'), {
      name: 'Mine',
      summary: 'Mine',
      bestFor: 'Me',
    })

  it('saves, lists newest first, and creates a valid product from a saved template', async () => {
    const a = await s.templateService.create({ ...content(), name: 'First' })
    await new Promise((r) => setTimeout(r, 5))
    const b = await s.templateService.create({ ...content(), name: 'Second' })
    expect((await s.templateService.list()).map((t) => t.name)).toEqual(['Second', 'First'])
    const bundle = resolveTemplate(a, { product: { name: 'From custom' }, anchor, sample: false })
    const product = await s.createProductFromBundle(bundle)
    expect((await s.countsForProduct(product.id)).initiatives).toBe(5)
    expect((await s.products.get(product.id))?.sampleData).toBeUndefined()
    expect(b.id).not.toBe(a.id)
  })

  it('duplicates a built-in or a custom template into an independent, editable copy', async () => {
    const fromBuiltIn = await s.templateService.duplicate(getTemplate('quarterly')!)
    expect(fromBuiltIn.name).toBe('Quarterly product roadmap (copy)')
    expect(fromBuiltIn.basedOn).toBe('Quarterly product roadmap')
    const copyOfCopy = await s.templateService.duplicate(fromBuiltIn.id)
    expect(copyOfCopy.name).toBe('Quarterly product roadmap (copy) (copy)')
    expect(copyOfCopy.id).not.toBe(fromBuiltIn.id)
    await s.templateService.update(fromBuiltIn.id, {
      name: 'Renamed',
      summary: 'New',
      bestFor: 'Others',
    })
    expect((await s.templates.get(copyOfCopy.id))?.name).toBe(
      'Quarterly product roadmap (copy) (copy)',
    ) // not shared
    expect(getTemplate('quarterly')!.name).toBe('Quarterly product roadmap') // the built-in is untouched
  })

  it('custom templates do not overwrite or depend on the plan they came from', async () => {
    const source = await s.createProductFromBundle(
      resolveTemplate(getTemplate('startup-mvp')!, { product: { name: 'Source' }, anchor }),
    )
    const plan = await s.planning.load(source.id)
    const roadmap = plan.roadmaps[0]!
    const t = await s.templateService.create(
      templateFromRoadmap(
        {
          product: source,
          roadmap,
          ...plan,
          objectives: plan.objectives,
          initiatives: plan.initiatives,
          features: plan.features,
          tags: plan.tags,
          milestones: plan.milestones,
          dependencies: plan.dependencies,
        },
        { name: 'Saved', summary: 's', bestFor: 'b' },
      ),
    )
    const sourceBefore = JSON.stringify(await s.planning.load(source.id))
    await s.templateService.update(t.id, { name: 'Edited', summary: 'x', bestFor: 'y' })
    await s.templateService.delete(t.id)
    expect(JSON.stringify(await s.planning.load(source.id))).toBe(sourceBefore)
    // And changing the plan afterwards does not change the template.
    const keep = (await s.templates.get(t.id, { includeDeleted: true }))!.initiatives.map(
      (i) => i.title,
    )
    await s.planning.deleteInitiative(source.id, plan.initiatives[0]!.id, 'cascade')
    expect(
      (await s.templates.get(t.id, { includeDeleted: true }))!.initiatives.map((i) => i.title),
    ).toEqual(keep)
  })

  it('delete is soft and restorable; unknown ids are reported', async () => {
    const t = await s.templateService.create(content())
    await s.templateService.delete(t.id)
    expect(await s.templateService.list()).toHaveLength(0)
    await s.templateService.restore(t.id)
    expect(await s.templateService.list()).toHaveLength(1)
    await expect(s.templateService.delete('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(s.templateService.duplicate('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects a template with a broken reference, and saves nothing', async () => {
    const bad = content()
    bad.initiatives[0]!.objective = 'ghost'
    await expect(s.templateService.create(bad)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await s.templates.list({ includeDeleted: true })).toHaveLength(0)
  })

  it('custom templates are part of a backup and come back on restore', async () => {
    await s.templateService.create(content())
    const { parseBackup, serializeBackup } = await import('@/storage')
    const text = serializeBackup(await s.exportBackup())
    const other = await freshStorage()
    await other.restoreBackup(parseBackup(text))
    expect((await other.templateService.list()).map((t) => t.name)).toEqual(['Mine'])
    await other.destroy()
  })
})
