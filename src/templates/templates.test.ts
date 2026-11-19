import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { dependencySchema, templateDefinitionSchema, type TemplateDefinition } from '@/domain'
import { freshStorage } from '@/storage/helpers.test-util'
import type { Storage } from '@/storage'
import { TEMPLATES, describeTemplate, getTemplate, resolveTemplate } from './index'
import { productBundleIsValid } from './test-util'

const anchor = new Date(Date.UTC(2026, 10, 19)) // 19 Nov 2026

describe('the six built-in templates', () => {
  it('are the six that were asked for, in order', () => {
    expect(TEMPLATES.map((t) => t.name)).toEqual([
      'Startup MVP roadmap',
      'SaaS product roadmap',
      'Quarterly product roadmap',
      'Feature development roadmap',
      'Product redesign roadmap',
      'Solo founder roadmap',
    ])
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(6)
  })

  it.each(TEMPLATES.map((t) => [t.name, t] as const))(
    '%s is a valid template with everything a template needs',
    (_n, t) => {
      expect(templateDefinitionSchema.safeParse(t).success).toBe(true)
      expect(t.objectives.length).toBeGreaterThanOrEqual(2)
      expect(t.initiatives.length).toBeGreaterThanOrEqual(4)
      expect(t.initiatives.every((i) => i.features.length > 0)).toBe(true)
      expect(t.structure.note.length).toBeGreaterThan(20) // a suggested way to plan
      expect(t.initiatives.some((i) => i.priority)).toBe(true) // example priorities
      expect(t.initiatives.every((i) => i.impact && i.effort && i.confidence)).toBe(true)
      expect(t.milestones.length).toBeGreaterThan(0)
    },
  )

  it.each(TEMPLATES.map((t) => [t.name, t] as const))(
    '%s resolves into valid, linked records, with sample data labelled',
    (_n, t) => {
      const b = resolveTemplate(t, { product: { name: 'X' }, anchor })
      expect(productBundleIsValid(b)).toEqual([])
      expect(b.initiatives).toHaveLength(t.initiatives.length)
      expect(b.roadmap.entries).toHaveLength(t.initiatives.length)
      expect(b.views.map((v) => v.layout)).toEqual(['now-next-later', 'timeline', 'board'])
      expect(b.product).toMatchObject({ sampleData: true, templateName: t.name })
      expect(b.roadmap).toMatchObject({
        planningMode: t.structure.planningMode,
        defaultView: t.structure.defaultView,
        planningHorizon: t.structure.horizon,
      })
      // Every initiative is under one of the template's objectives, every feature under an initiative.
      const objectiveIds = new Set(b.objectives.map((o) => o.id))
      const initiativeIds = new Set(b.initiatives.map((i) => i.id))
      expect(b.initiatives.every((i) => !i.objectiveId || objectiveIds.has(i.objectiveId))).toBe(
        true,
      )
      expect(b.features.every((f) => f.initiativeId && initiativeIds.has(f.initiativeId))).toBe(
        true,
      )
    },
  )

  it('the sequenced templates carry valid dependency links that run forward in time', () => {
    for (const id of ['saas-product', 'feature-development', 'product-redesign']) {
      const b = resolveTemplate(getTemplate(id)!, { product: { name: 'X' }, anchor })
      expect(b.dependencies.length).toBeGreaterThan(0)
      const now = new Date().toISOString()
      for (const d of b.dependencies) {
        expect(dependencySchema.safeParse({ ...d, createdAt: now, updatedAt: now }).success).toBe(
          true,
        )
        const from = b.initiatives.find((i) => i.id === d.fromId)!
        const to = b.initiatives.find((i) => i.id === d.toId)!
        // What is blocked starts after its blocker ends, so the sample shows no red conflict lines.
        expect(to.startDate! > from.endDate!, `${from.title} → ${to.title}`).toBe(true)
      }
    }
  })

  it('the quarterly template plans by date; the others are flexible', () => {
    expect(getTemplate('quarterly')!.structure).toMatchObject({
      planningMode: 'dates',
      defaultView: 'timeline',
      horizon: '3-months',
    })
    expect(
      TEMPLATES.filter((t) => t.id !== 'quarterly').every(
        (t) => t.structure.planningMode === 'flexible',
      ),
    ).toBe(true)
  })
})

describe('resolveTemplate', () => {
  it('uses real dates from the anchor month', () => {
    const b = resolveTemplate(getTemplate('solo-founder')!, { product: { name: 'X' }, anchor })
    const core = b.initiatives.find((i) => i.title === 'Build the core workflow')!
    expect(core.startDate).toBe('2026-11-01')
    expect(core.endDate).toBe('2027-01-31')
  })

  it('maps levels, confidence and priority onto the records', () => {
    const b = resolveTemplate(getTemplate('startup-mvp')!, { product: { name: 'X' }, anchor })
    expect(b.initiatives.find((i) => i.title === 'Build the MVP')).toMatchObject({
      priority: 'critical',
      confidence: 'tentative',
      scoring: { impact: 'high', effort: 'high' },
    })
    expect(b.features.find((f) => f.title === 'Core workflow')).toMatchObject({
      priority: 'critical',
    })
  })

  it('returns independent copies with fresh ids each time, and never changes the template', () => {
    const t = getTemplate('startup-mvp')!
    const before = JSON.stringify(t)
    const a = resolveTemplate(t, { product: { name: 'A' }, anchor })
    const b = resolveTemplate(t, { product: { name: 'B' }, anchor })
    expect(a.product.id).not.toBe(b.product.id)
    expect(a.initiatives[0]!.id).not.toBe(b.initiatives[0]!.id)
    a.initiatives[0]!.title = 'Changed'
    expect(JSON.stringify(t)).toBe(before)
  })

  it('lets the caller override the template defaults', () => {
    const b = resolveTemplate(getTemplate('startup-mvp')!, {
      product: { name: 'Mine', category: 'mobile-app', planningHorizon: '12-months' },
      anchor,
    })
    expect(b.product).toMatchObject({
      name: 'Mine',
      category: 'mobile-app',
      planningHorizon: '12-months',
    })
  })

  it("does not label the result as sample data when it is the person's own structure", () => {
    const b = resolveTemplate(getTemplate('startup-mvp')!, {
      product: { name: 'Mine' },
      anchor,
      sample: false,
    })
    expect(b.product.sampleData).toBeUndefined()
    expect(b.product.templateName).toBeUndefined()
  })

  it('leaves undated initiatives undated', () => {
    const t: TemplateDefinition = {
      ...getTemplate('startup-mvp')!,
      initiatives: [{ ...getTemplate('startup-mvp')!.initiatives[0]!, months: undefined }],
      milestones: [],
    }
    const b = resolveTemplate(t, { product: { name: 'X' }, anchor })
    expect(b.initiatives[0]!.startDate).toBeUndefined()
  })

  it('describes contents truthfully', () => {
    expect(describeTemplate(getTemplate('feature-development')!)).toBe(
      '3 objectives · 5 initiatives · 10 features',
    )
  })
})

describe('the template schema refuses broken templates', () => {
  const base = () => structuredClone(getTemplate('feature-development')!)
  it('rejects an unknown objective, a link to nothing, a self link and a loop', () => {
    const a = base()
    a.initiatives[0]!.objective = 'ghost'
    expect(templateDefinitionSchema.safeParse(a).success).toBe(false)
    const b = base()
    b.initiatives[0]!.links = [{ to: 'ghost', kind: 'blocks' }]
    expect(templateDefinitionSchema.safeParse(b).success).toBe(false)
    const c = base()
    c.initiatives[0]!.links = [{ to: c.initiatives[0]!.key, kind: 'blocks' }]
    expect(templateDefinitionSchema.safeParse(c).success).toBe(false)
    const d = base()
    d.initiatives[4]!.links = [{ to: 'discovery', kind: 'blocks' }] // review → discovery closes the chain
    expect(templateDefinitionSchema.safeParse(d).success).toBe(false)
  })
  it('rejects duplicate keys and months that run backwards', () => {
    const a = base()
    a.initiatives[1]!.key = a.initiatives[0]!.key
    expect(templateDefinitionSchema.safeParse(a).success).toBe(false)
    const b = base()
    b.initiatives[0]!.months = [3, 1]
    expect(templateDefinitionSchema.safeParse(b).success).toBe(false)
  })
})

describe('creating a product from a template', () => {
  let s: Storage
  beforeEach(async () => {
    s = await freshStorage()
  })
  afterEach(async () => {
    await s.destroy()
  })

  it('writes the whole product, dependencies included, atomically and linked together', async () => {
    const b = resolveTemplate(getTemplate('saas-product')!, { product: { name: 'Orbit' }, anchor })
    const product = await s.createProductFromBundle(b)
    const counts = await s.countsForProduct(product.id)
    expect(counts).toEqual({
      objectives: 3,
      initiatives: 6,
      features: 15,
      milestones: 2,
      roadmaps: 1,
    })
    expect((await s.planning.load(product.id)).dependencies).toHaveLength(2)
    expect((await s.products.get(product.id))?.sampleData).toBe(true)
    const roadmap = (await s.roadmaps.findBy('productId', product.id))[0]!
    expect(roadmap.planningMode).toBe('flexible')
    for (const e of roadmap.entries) expect(await s.initiatives.get(e.itemId)).toBeTruthy()
  })

  it('every built-in template creates a valid hierarchy that survives a backup round trip', async () => {
    for (const t of TEMPLATES)
      await s.createProductFromBundle(resolveTemplate(t, { product: { name: t.name }, anchor }))
    expect(await s.products.list()).toHaveLength(6)
    const { parseBackup, serializeBackup } = await import('@/storage')
    const text = serializeBackup(await s.exportBackup())
    expect(() => parseBackup(text)).not.toThrow()
  })

  it('saves nothing when any record is invalid', async () => {
    const b = resolveTemplate(getTemplate('startup-mvp')!, { product: { name: 'Orbit' }, anchor })
    b.features[3]!.title = ''
    await expect(s.createProductFromBundle(b)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await s.products.list({ includeDeleted: true })).toHaveLength(0)
    expect(await s.initiatives.list({ includeDeleted: true })).toHaveLength(0)
  })

  it('leaves the template untouched and allows using it twice', async () => {
    const t = getTemplate('solo-founder')!
    const before = JSON.stringify(t)
    await s.createProductFromBundle(resolveTemplate(t, { product: { name: 'One' }, anchor }))
    await s.createProductFromBundle(resolveTemplate(t, { product: { name: 'Two' }, anchor }))
    expect(JSON.stringify(t)).toBe(before)
    expect(await s.products.list()).toHaveLength(2)
  })
})
