import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { productBundleIsValid } from './test-util'
import { TEMPLATES, describeTemplate, getTemplate, resolveTemplate } from './index'
import { freshStorage } from '@/storage/helpers.test-util'
import type { Storage } from '@/storage'

const anchor = new Date(Date.UTC(2026, 10, 19)) // 19 Nov 2026

describe('resolveTemplate', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s resolves into valid, linked records',
    (_id, t) => {
      const b = resolveTemplate(t, { product: { name: 'X' }, anchor })
      expect(productBundleIsValid(b)).toEqual([])
      expect(b.initiatives).toHaveLength(t.initiatives.length)
      expect(b.roadmap.entries).toHaveLength(t.initiatives.length)
      expect(b.views.map((v) => v.layout)).toEqual(['now-next-later', 'timeline', 'board'])
    },
  )

  it('uses real dates from the anchor month', () => {
    const b = resolveTemplate(getTemplate('solo-maker-launch')!, { product: { name: 'X' }, anchor })
    const core = b.initiatives.find((i) => i.title === 'Build the core workflow')!
    expect(core.startDate).toBe('2026-11-01')
    expect(core.endDate).toBe('2027-01-31')
  })

  it('returns independent copies with fresh ids each time', () => {
    const t = getTemplate('saas-mvp')!
    const a = resolveTemplate(t, { product: { name: 'A' }, anchor })
    const b = resolveTemplate(t, { product: { name: 'B' }, anchor })
    expect(a.product.id).not.toBe(b.product.id)
    expect(a.initiatives[0]!.id).not.toBe(b.initiatives[0]!.id)
    a.initiatives[0]!.title = 'Changed'
    expect(t.initiatives[0]!.title).not.toBe('Changed')
  })

  it('lets the caller override the template defaults', () => {
    const b = resolveTemplate(getTemplate('saas-mvp')!, {
      product: { name: 'Mine', category: 'mobile-app', planningHorizon: '12-months' },
      anchor,
    })
    expect(b.product).toMatchObject({
      name: 'Mine',
      category: 'mobile-app',
      planningHorizon: '12-months',
    })
  })

  it('describes contents truthfully', () => {
    expect(describeTemplate(getTemplate('client-product')!)).toBe(
      '2 objectives · 4 initiatives · 8 features',
    )
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

  it('writes the whole product atomically and links it together', async () => {
    const b = resolveTemplate(getTemplate('saas-mvp')!, { product: { name: 'Orbit' }, anchor })
    const product = await s.createProductFromBundle(b)
    expect(await s.countsForProduct(product.id)).toEqual({
      objectives: 3,
      initiatives: 5,
      features: 11,
      milestones: 2,
      roadmaps: 1,
    })
    expect(await s.roadmapViews.findBy('productId', product.id)).toHaveLength(3)
    const roadmap = (await s.roadmaps.findBy('productId', product.id))[0]!
    for (const e of roadmap.entries) expect(await s.initiatives.get(e.itemId)).toBeTruthy()
  })

  it('saves nothing when any record is invalid', async () => {
    const b = resolveTemplate(getTemplate('saas-mvp')!, { product: { name: 'Orbit' }, anchor })
    b.features[3]!.title = ''
    await expect(s.createProductFromBundle(b)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await s.products.list({ includeDeleted: true })).toHaveLength(0)
    expect(await s.initiatives.list({ includeDeleted: true })).toHaveLength(0)
  })

  it('leaves the template untouched and allows using it twice', async () => {
    const t = getTemplate('solo-maker-launch')!
    const before = JSON.stringify(t)
    await s.createProductFromBundle(resolveTemplate(t, { product: { name: 'One' }, anchor }))
    await s.createProductFromBundle(resolveTemplate(t, { product: { name: 'Two' }, anchor }))
    expect(JSON.stringify(t)).toBe(before)
    expect(await s.products.list()).toHaveLength(2)
  })
})
