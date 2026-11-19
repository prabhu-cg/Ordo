import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Storage } from './index'
import { StorageError } from './errors'
import {
  featureInput,
  freshStorage,
  initiativeInput,
  objectiveInput,
  productInput,
} from './helpers.test-util'

let s: Storage
beforeEach(async () => {
  s = await freshStorage()
})
afterEach(async () => {
  await s.destroy()
})

describe('create and read', () => {
  it('creates a product with id and timestamps, and reads it back', async () => {
    const p = await s.products.create(productInput())
    expect(p.id).toBeTruthy()
    expect(p.createdAt).toBe(p.updatedAt)
    expect(await s.products.get(p.id)).toEqual(p)
  })

  it('trims text and rejects invalid input with field errors', async () => {
    const p = await s.products.create({ name: '  Atlas  ' })
    expect(p.name).toBe('Atlas')
    const err = await s.products.create({ name: '   ' }).catch((e) => e)
    expect(err).toBeInstanceOf(StorageError)
    expect(err.code).toBe('VALIDATION')
    expect(err.fieldErrors.name).toMatch(/required/i)
    expect(await s.products.count()).toBe(1)
  })

  it('persists optional fields as optional', async () => {
    const p = await s.products.create({ name: 'Atlas', vision: 'Everyone plans' })
    expect(p.tagline).toBeUndefined()
    expect(p.vision).toBe('Everyone plans')
  })

  it('rejects a feature whose end date precedes its start date', async () => {
    const p = await s.products.create(productInput())
    const err = await s.features
      .create(featureInput(p.id, { startDate: '2026-05-10', endDate: '2026-05-01' }))
      .catch((e) => e)
    expect(err.code).toBe('VALIDATION')
    expect(err.fieldErrors.endDate).toBeTruthy()
  })

  it('rejects out-of-range scores', async () => {
    const p = await s.products.create(productInput())
    const err = await s.initiatives
      .create(initiativeInput(p.id, { scoring: { impact: 9 } }))
      .catch((e) => e)
    expect(err.code).toBe('VALIDATION')
  })
})

describe('update', () => {
  it('merges a patch, bumps updatedAt, keeps createdAt', async () => {
    const p = await s.products.create(productInput())
    await new Promise((r) => setTimeout(r, 5))
    const next = await s.products.update(p.id, { name: 'Atlas 2' })
    expect(next.name).toBe('Atlas 2')
    expect(next.createdAt).toBe(p.createdAt)
    expect(next.updatedAt > p.updatedAt).toBe(true)
  })

  it('clears an optional field when patched to undefined', async () => {
    const p = await s.products.create({ name: 'Atlas', tagline: 'Maps' })
    const next = await s.products.update(p.id, { tagline: undefined })
    expect(next.tagline).toBeUndefined()
  })

  it('does not write when validation fails', async () => {
    const p = await s.products.create(productInput())
    await expect(s.products.update(p.id, { name: '' })).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    expect((await s.products.get(p.id))?.name).toBe('Atlas')
  })

  it('reports NOT_FOUND for a missing id', async () => {
    await expect(s.products.update('nope', { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('rejects a stale write with CONFLICT', async () => {
    const p = await s.products.create(productInput())
    await new Promise((r) => setTimeout(r, 5))
    await s.products.update(p.id, { name: 'Changed elsewhere' })
    await expect(
      s.products.update(p.id, { name: 'Mine' }, { expectedUpdatedAt: p.updatedAt }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await s.products.get(p.id))?.name).toBe('Changed elsewhere')
  })
})

describe('soft deletion', () => {
  it('hides archived records by default and restores them', async () => {
    const p = await s.products.create(productInput())
    await s.products.remove(p.id)
    expect(await s.products.get(p.id)).toBeUndefined()
    expect(await s.products.list()).toHaveLength(0)
    expect((await s.products.get(p.id, { includeDeleted: true }))?.deletedAt).toBeTruthy()
    const back = await s.products.restore(p.id)
    expect(back.deletedAt).toBeUndefined()
    expect(await s.products.list()).toHaveLength(1)
  })

  it('removing twice is harmless', async () => {
    const p = await s.products.create(productInput())
    await s.products.remove(p.id)
    await expect(s.products.remove(p.id)).resolves.toBeUndefined()
  })

  it('purge permanently deletes', async () => {
    const p = await s.products.create(productInput())
    await s.products.purge(p.id)
    expect(await s.products.get(p.id, { includeDeleted: true })).toBeUndefined()
  })

  it('hard-removes entities that are not soft-deletable', async () => {
    const p = await s.products.create(productInput())
    const a = await s.initiatives.create(initiativeInput(p.id))
    const b = await s.features.create(featureInput(p.id))
    const d = await s.dependencies.create({
      productId: p.id,
      fromType: 'initiative',
      fromId: a.id,
      toType: 'feature',
      toId: b.id,
      kind: 'blocks',
    })
    await s.dependencies.remove(d.id)
    expect(await s.dependencies.get(d.id)).toBeUndefined()
  })
})

describe('relationships and indexed queries', () => {
  it('holds the product → objective → initiative → feature tree and queries it by index', async () => {
    const p = await s.products.create(productInput())
    const other = await s.products.create(productInput('Other'))
    const o = await s.objectives.create(objectiveInput(p.id))
    const i = await s.initiatives.create(initiativeInput(p.id, { objectiveId: o.id }))
    await s.features.create(featureInput(p.id, { initiativeId: i.id }))
    await s.features.create(featureInput(p.id, { initiativeId: i.id, title: 'Export' }))
    await s.initiatives.create(initiativeInput(other.id))

    expect(await s.initiatives.findBy('productId', p.id)).toHaveLength(1)
    expect(await s.initiatives.findBy('objectiveId', o.id)).toHaveLength(1)
    expect(await s.features.findBy('initiativeId', i.id)).toHaveLength(2)
    expect(await s.countsForProduct(p.id)).toMatchObject({
      objectives: 1,
      initiatives: 1,
      features: 2,
    })
  })

  it('finds items by tag through the multi-entry index', async () => {
    const p = await s.products.create(productInput())
    const tag = await s.tags.create({ productId: p.id, name: 'Growth', tone: 'amber' })
    await s.initiatives.create(initiativeInput(p.id, { tagIds: [tag.id] }))
    await s.initiatives.create(initiativeInput(p.id, { title: 'Untagged' }))
    expect(await s.initiatives.findBy('tagIds', tag.id)).toHaveLength(1)
  })

  it('lets a milestone stand alone or link to an initiative', async () => {
    const p = await s.products.create(productInput())
    const i = await s.initiatives.create(initiativeInput(p.id))
    const solo = await s.milestones.create({
      productId: p.id,
      title: 'Launch',
      date: '2026-09-01',
      status: 'upcoming',
    })
    const linked = await s.milestones.create({
      productId: p.id,
      title: 'Beta',
      date: '2026-07-01',
      status: 'upcoming',
      initiativeId: i.id,
    })
    expect(solo.initiativeId).toBeUndefined()
    expect((await s.milestones.findBy('initiativeId', i.id)).map((m) => m.id)).toEqual([linked.id])
  })

  it('lets roadmaps and views reference the same records without copying them', async () => {
    const p = await s.products.create(productInput())
    const i = await s.initiatives.create(initiativeInput(p.id))
    const r = await s.roadmaps.create({
      productId: p.id,
      name: 'Main',
      entries: [{ itemType: 'initiative', itemId: i.id, lane: 'now', order: 1 }],
    })
    const v1 = await s.roadmapViews.create({
      productId: p.id,
      roadmapId: r.id,
      name: 'Now/Next/Later',
      layout: 'now-next-later',
      config: {},
      order: 1,
    })
    const v2 = await s.roadmapViews.create({
      productId: p.id,
      roadmapId: r.id,
      name: 'Timeline',
      layout: 'timeline',
      config: { zoom: 'quarter' },
      order: 2,
    })
    await s.initiatives.update(i.id, { title: 'Onboarding v2' })
    const entry = (await s.roadmaps.get(r.id))!.entries[0]!
    expect((await s.initiatives.get(entry.itemId))?.title).toBe('Onboarding v2')
    expect((await s.roadmapViews.findBy('roadmapId', r.id)).map((v) => v.id).sort()).toEqual(
      [v1.id, v2.id].sort(),
    )
  })

  it('refuses a dependency on itself', async () => {
    const p = await s.products.create(productInput())
    const i = await s.initiatives.create(initiativeInput(p.id))
    await expect(
      s.dependencies.create({
        productId: p.id,
        fromType: 'initiative',
        fromId: i.id,
        toType: 'initiative',
        toId: i.id,
        kind: 'blocks',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('purgeProduct removes the product and everything inside it, and nothing else', async () => {
    const a = await s.products.create(productInput('A'))
    const b = await s.products.create(productInput('B'))
    await s.initiatives.create(initiativeInput(a.id))
    await s.initiatives.create(initiativeInput(b.id))
    await s.purgeProduct(a.id)
    expect(await s.products.get(a.id, { includeDeleted: true })).toBeUndefined()
    expect(await s.initiatives.findBy('productId', a.id, { includeDeleted: true })).toHaveLength(0)
    expect(await s.initiatives.findBy('productId', b.id)).toHaveLength(1)
    expect(await s.revisions.forProduct(a.id)).toHaveLength(0)
  })
})

describe('revisions', () => {
  it('appends a revision for create, update, delete and restore', async () => {
    const p = await s.products.create(productInput())
    await s.products.update(p.id, { name: 'Atlas 2' })
    await s.products.remove(p.id)
    await s.products.restore(p.id)
    const history = await s.revisions.forEntity('product', p.id)
    expect(history.map((r) => r.action).sort()).toEqual(['create', 'delete', 'restore', 'update'])
    expect(history.every((r) => r.productId === p.id)).toBe(true)
    expect(history.find((r) => r.action === 'update')?.snapshot.name).toBe('Atlas 2')
  })

  it('writes nothing when the transaction fails', async () => {
    const p = await s.products.create(productInput())
    const before = (await s.revisions.forProduct(p.id)).length
    await s.products.update(p.id, { name: '' }).catch(() => {})
    expect((await s.revisions.forProduct(p.id)).length).toBe(before)
  })
})

describe('meta', () => {
  it('stores and clears small settings', async () => {
    await s.meta.set('activeProductId', 'abc')
    expect(await s.meta.get('activeProductId')).toBe('abc')
    await s.meta.remove('activeProductId')
    expect(await s.meta.get('activeProductId')).toBeUndefined()
  })
})
