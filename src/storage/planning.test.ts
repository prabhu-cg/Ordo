import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Storage } from './index'
import { freshStorage } from './helpers.test-util'

let s: Storage
let productId: string
beforeEach(async () => {
  s = await freshStorage()
  productId = (await s.products.create({ name: 'Atlas' })).id
})
afterEach(async () => {
  await s.destroy()
})

const objective = (title = 'Grow') => ({ title, status: 'active' as const })
const initiative = (title: string, over: Record<string, unknown> = {}) => ({
  title,
  status: 'idea' as const,
  tagIds: [],
  ...over,
})
const feature = (title: string, over: Record<string, unknown> = {}) => ({
  title,
  status: 'idea' as const,
  tagIds: [],
  ...over,
})

/** A full hierarchy: objective > initiative > two features, with a roadmap entry and a dependency on each level. */
async function hierarchy() {
  const o = await s.planning.saveObjective(productId, objective())
  const i = await s.planning.saveInitiative(productId, initiative('Beta', { objectiveId: o.id }))
  const other = await s.planning.saveInitiative(productId, initiative('Other'))
  const f1 = await s.planning.saveFeature(productId, feature('Invite', { initiativeId: i.id }))
  const f2 = await s.planning.saveFeature(productId, feature('Feedback', { initiativeId: i.id }))
  const roadmap = await s.roadmaps.create({
    productId,
    name: 'Main',
    entries: [
      { itemType: 'initiative', itemId: i.id, lane: 'now', order: 1 },
      { itemType: 'initiative', itemId: other.id, lane: 'next', order: 2 },
      { itemType: 'feature', itemId: f1.id, order: 3 },
    ],
  })
  const dep = await s.dependencies.create({
    productId,
    fromType: 'feature',
    fromId: f1.id,
    toType: 'initiative',
    toId: other.id,
    kind: 'blocks',
  })
  const milestone = await s.milestones.create({
    productId,
    title: 'Beta live',
    date: '2026-12-01',
    status: 'upcoming',
    initiativeId: i.id,
  })
  return { o, i, other, f1, f2, roadmap, dep, milestone }
}

describe('objectives', () => {
  it('creates, reads, edits with outcomes, and numbers them in order', async () => {
    const a = await s.planning.saveObjective(productId, {
      ...objective('First users'),
      description: 'Real people',
      targetDate: '2026-12-31',
      outcomes: [
        {
          id: '',
          title: 'Weekly active users',
          metric: 'WAU',
          unit: 'users',
          baseline: 0,
          target: 25,
          current: 4,
        },
      ],
    })
    const b = await s.planning.saveObjective(productId, objective('Second'))
    expect(b.order).toBeGreaterThan(a.order)
    expect(a.outcomes?.[0]?.id).toBeTruthy() // ids are assigned for new outcomes

    const edited = await s.planning.saveObjective(
      productId,
      { ...objective('First users'), outcomes: [{ ...a.outcomes![0]!, current: 12 }] },
      a.id,
    )
    expect(edited.outcomes?.[0]?.current).toBe(12)
    expect(edited.targetDate).toBeUndefined() // cleared by the edit

    const { objectives } = await s.planning.load(productId)
    expect(objectives.map((o) => o.title).sort()).toEqual(['First users', 'Second'])
  })

  it('supports several objectives per product and keeps products separate', async () => {
    const other = await s.products.create({ name: 'Other' })
    await s.planning.saveObjective(productId, objective('A'))
    await s.planning.saveObjective(productId, objective('B'))
    await s.planning.saveObjective(other.id, objective('C'))
    expect((await s.planning.load(productId)).objectives).toHaveLength(2)
    expect((await s.planning.load(other.id)).objectives).toHaveLength(1)
  })

  it('rejects an outcome whose target equals its baseline, and bad numbers', async () => {
    await expect(
      s.planning.saveObjective(productId, {
        ...objective(),
        outcomes: [{ id: 'x', title: 'Flat', baseline: 5, target: 5, current: 5 }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      s.planning.saveObjective(productId, {
        ...objective(),
        outcomes: [{ id: 'x', title: 'Bad', baseline: 0, target: Number.NaN, current: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await s.planning.load(productId)).objectives).toHaveLength(0)
  })

  it('refuses to edit an objective from another product', async () => {
    const other = await s.products.create({ name: 'Other' })
    const o = await s.planning.saveObjective(other.id, objective())
    await expect(
      s.planning.saveObjective(productId, objective('Hijack'), o.id),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('initiatives', () => {
  it('creates, edits and links to an objective, with scoring, priority and owner', async () => {
    const o = await s.planning.saveObjective(productId, objective())
    const i = await s.planning.saveInitiative(
      productId,
      initiative('Beta', {
        objectiveId: o.id,
        priority: 'high',
        owner: 'Sam',
        status: 'planned',
        confidence: 'tentative',
        scoring: { impact: 'high', effort: 'low' },
      }),
    )
    expect(i).toMatchObject({
      objectiveId: o.id,
      priority: 'high',
      owner: 'Sam',
      confidence: 'tentative',
      scoring: { impact: 'high', effort: 'low' },
    })
    const moved = await s.planning.saveInitiative(
      productId,
      initiative('Beta', { priority: 'low' }),
      i.id,
    )
    expect(moved.objectiveId).toBeUndefined()
    expect(moved.priority).toBe('low')
  })

  it('rejects a missing, archived or foreign objective', async () => {
    const other = await s.products.create({ name: 'Other' })
    const foreign = await s.planning.saveObjective(other.id, objective())
    const archived = await s.planning.saveObjective(productId, objective('Gone'))
    await s.objectives.remove(archived.id)
    for (const objectiveId of ['ghost', foreign.id, archived.id]) {
      await expect(
        s.planning.saveInitiative(productId, initiative('X', { objectiveId })),
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        fieldErrors: { objectiveId: expect.any(String) },
      })
    }
    expect((await s.planning.load(productId)).initiatives).toHaveLength(0)
  })

  it('validates dates and scores through the schema', async () => {
    await expect(
      s.planning.saveInitiative(
        productId,
        initiative('X', { startDate: '2026-05-02', endDate: '2026-05-01' }),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      s.planning.saveInitiative(productId, initiative('X', { scoring: { impact: 6 as never } })),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('features', () => {
  it('creates and edits with initiative link, tags, dates and owner', async () => {
    const i = await s.planning.saveInitiative(productId, initiative('Beta'))
    const f = await s.planning.saveFeature(
      productId,
      feature('Invite', {
        initiativeId: i.id,
        priority: 'critical',
        owner: 'Lee',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        scoring: { impact: 'high', effort: 'medium' },
        confidence: 'committed',
        newTags: ['Growth'],
      }),
    )
    expect(f).toMatchObject({
      initiativeId: i.id,
      priority: 'critical',
      owner: 'Lee',
      startDate: '2026-11-01',
    })
    expect(f.tagIds).toHaveLength(1)
    const done = await s.planning.saveFeature(
      productId,
      feature('Invite', { initiativeId: i.id, status: 'shipped', tagIds: f.tagIds }),
      f.id,
    )
    expect(done.status).toBe('shipped')
  })

  it('rejects a missing initiative and one from another product', async () => {
    const other = await s.products.create({ name: 'Other' })
    const foreign = await s.planning.saveInitiative(other.id, initiative('Theirs'))
    for (const initiativeId of ['ghost', foreign.id]) {
      await expect(
        s.planning.saveFeature(productId, feature('X', { initiativeId })),
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        fieldErrors: { initiativeId: expect.any(String) },
      })
    }
  })

  it('may exist with no initiative', async () => {
    const f = await s.planning.saveFeature(productId, feature('Loose'))
    expect(f.initiativeId).toBeUndefined()
  })
})

describe('tags', () => {
  it('creates new tags once per name, ignoring case, and reuses them', async () => {
    const a = await s.planning.saveFeature(
      productId,
      feature('A', { newTags: ['Growth', ' growth ', 'Bug'] }),
    )
    const b = await s.planning.saveInitiative(productId, initiative('B', { newTags: ['GROWTH'] }))
    expect((await s.planning.load(productId)).tags).toHaveLength(2)
    expect(a.tagIds).toHaveLength(2)
    expect(b.tagIds).toHaveLength(1)
    expect(a.tagIds).toContain(b.tagIds[0])
  })

  it('rejects an unknown tag id and rolls the whole save back', async () => {
    await expect(
      s.planning.saveFeature(productId, feature('A', { tagIds: ['ghost'], newTags: ['New'] })),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    const data = await s.planning.load(productId)
    expect(data.features).toHaveLength(0)
    expect(data.tags).toHaveLength(0)
  })

  it('deleting a tag removes it from every item', async () => {
    const f = await s.planning.saveFeature(productId, feature('A', { newTags: ['Growth'] }))
    const i = await s.planning.saveInitiative(productId, initiative('B', { tagIds: f.tagIds }))
    await s.planning.deleteTag(productId, f.tagIds[0]!)
    expect((await s.features.get(f.id))?.tagIds).toEqual([])
    expect((await s.initiatives.get(i.id))?.tagIds).toEqual([])
    expect((await s.planning.load(productId)).tags.filter((t) => !t.deletedAt)).toHaveLength(0)
  })
})

describe('deleting a feature', () => {
  it('archives it and removes its roadmap entries and dependencies', async () => {
    const { f1, roadmap, dep } = await hierarchy()
    await s.planning.deleteFeature(productId, f1.id)
    expect(await s.features.get(f1.id)).toBeUndefined()
    expect((await s.roadmaps.get(roadmap.id))!.entries.some((e) => e.itemId === f1.id)).toBe(false)
    expect(await s.dependencies.get(dep.id)).toBeUndefined()
  })
})

describe('deleting an initiative', () => {
  it('unlink: features stay, with no initiative; milestones unlink; roadmap and dependencies are cleaned', async () => {
    const { i, f1, f2, other, roadmap, milestone } = await hierarchy()
    await s.planning.deleteInitiative(productId, i.id, 'unlink')
    expect(await s.initiatives.get(i.id)).toBeUndefined()
    expect((await s.features.get(f1.id))?.initiativeId).toBeUndefined()
    expect((await s.features.get(f2.id))?.initiativeId).toBeUndefined()
    expect((await s.milestones.get(milestone.id))?.initiativeId).toBeUndefined()
    const entries = (await s.roadmaps.get(roadmap.id))!.entries
    expect(entries.map((e) => e.itemId).sort()).toEqual([other.id, f1.id].sort())
  })

  it('cascade: features are deleted with it', async () => {
    const { i, f1, f2, roadmap, dep } = await hierarchy()
    await s.planning.deleteInitiative(productId, i.id, 'cascade')
    expect(await s.features.get(f1.id)).toBeUndefined()
    expect(await s.features.get(f2.id)).toBeUndefined()
    expect((await s.roadmaps.get(roadmap.id))!.entries.map((e) => e.itemId)).not.toContain(f1.id)
    expect(await s.dependencies.get(dep.id)).toBeUndefined() // it pointed from a deleted feature
  })
})

describe('deleting an objective', () => {
  it('unlink: initiatives and features all stay, initiatives lose the objective', async () => {
    const { o, i, f1 } = await hierarchy()
    await s.planning.deleteObjective(productId, o.id, 'unlink')
    expect(await s.objectives.get(o.id)).toBeUndefined()
    expect((await s.initiatives.get(i.id))?.objectiveId).toBeUndefined()
    expect(await s.features.get(f1.id)).toBeTruthy()
  })

  it('cascade: its initiatives and their features go too, other initiatives stay', async () => {
    const { o, i, f1, f2, other } = await hierarchy()
    await s.planning.deleteObjective(productId, o.id, 'cascade')
    for (const gone of [i.id]) expect(await s.initiatives.get(gone)).toBeUndefined()
    expect(await s.features.get(f1.id)).toBeUndefined()
    expect(await s.features.get(f2.id)).toBeUndefined()
    expect(await s.initiatives.get(other.id)).toBeTruthy()
  })
})

describe('no orphans', () => {
  it('after any deletion no live record points at a missing or archived parent', async () => {
    const { o, i } = await hierarchy()
    await s.planning.deleteInitiative(productId, i.id, 'unlink')
    await s.planning.deleteObjective(productId, o.id, 'unlink')
    const { objectives, initiatives, features } = await s.planning.load(productId)
    const liveObjectives = new Set(objectives.filter((x) => !x.deletedAt).map((x) => x.id))
    const liveInitiatives = new Set(initiatives.filter((x) => !x.deletedAt).map((x) => x.id))
    for (const x of initiatives.filter((r) => !r.deletedAt))
      if (x.objectiveId) expect(liveObjectives.has(x.objectiveId)).toBe(true)
    for (const x of features.filter((r) => !r.deletedAt))
      if (x.initiativeId) expect(liveInitiatives.has(x.initiativeId)).toBe(true)
  })

  it('a failed delete changes nothing', async () => {
    const { o, i } = await hierarchy()
    await expect(s.planning.deleteObjective(productId, 'ghost', 'cascade')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(await s.objectives.get(o.id)).toBeTruthy()
    expect(await s.initiatives.get(i.id)).toBeTruthy()
  })

  it('a backup of a product after deletions still passes the integrity checks', async () => {
    const { o } = await hierarchy()
    await s.planning.deleteObjective(productId, o.id, 'cascade')
    const { parseBackup, serializeBackup } = await import('./backup')
    const text = serializeBackup(await s.exportBackup())
    expect(() => parseBackup(text)).not.toThrow()
  })
})

describe('propagation', () => {
  it("moves the product's updatedAt forward whenever anything inside it changes", async () => {
    const before = (await s.products.get(productId))!.updatedAt
    await new Promise((r) => setTimeout(r, 5))
    const o = await s.planning.saveObjective(productId, objective())
    const t1 = (await s.products.get(productId))!.updatedAt
    expect(t1 > before).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    await s.planning.deleteObjective(productId, o.id, 'unlink')
    expect((await s.products.get(productId))!.updatedAt > t1).toBe(true)
  })

  it('records a revision for each planning change', async () => {
    const o = await s.planning.saveObjective(productId, objective())
    await s.planning.saveObjective(productId, objective('Renamed'), o.id)
    await s.planning.deleteObjective(productId, o.id, 'unlink')
    expect((await s.revisions.forEntity('objective', o.id)).map((r) => r.action).sort()).toEqual([
      'create',
      'delete',
      'update',
    ])
  })

  it('refuses to work on a missing product', async () => {
    await expect(s.planning.saveObjective('ghost', objective())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})
