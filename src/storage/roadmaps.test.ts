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

const init = (title: string, over: Record<string, unknown> = {}) =>
  s.planning.saveInitiative(productId, { title, status: 'idea', tagIds: [], ...over })
const feat = (title: string, over: Record<string, unknown> = {}) =>
  s.planning.saveFeature(productId, { title, status: 'idea', tagIds: [], ...over })
const fields = (over: Record<string, unknown> = {}) => ({ name: 'Main', ...over })

describe('creating and editing roadmaps', () => {
  it('creates several roadmaps, each with its three views, and no entries by default', async () => {
    const a = await s.roadmapService.create(productId, fields())
    const b = await s.roadmapService.create(productId, fields({ name: 'Client view' }))
    expect(a.entries).toEqual([])
    const { views, roadmaps } = await s.planning.load(productId)
    expect(roadmaps).toHaveLength(2)
    expect(
      views
        .filter((v) => v.roadmapId === a.id)
        .map((v) => v.layout)
        .sort(),
    ).toEqual(['board', 'now-next-later', 'timeline'])
    expect(views.filter((v) => v.roadmapId === b.id)).toHaveLength(3)
  })

  it('stores name, description, horizon, default view, planning mode and item types', async () => {
    const r = await s.roadmapService.create(
      productId,
      fields({
        description: 'For investors',
        planningHorizon: '12-months',
        defaultView: 'timeline',
        planningMode: 'dates',
        itemTypes: ['initiative', 'milestone'],
      }),
    )
    expect(r).toMatchObject({
      name: 'Main',
      description: 'For investors',
      planningHorizon: '12-months',
      defaultView: 'timeline',
      planningMode: 'dates',
      itemTypes: ['initiative', 'milestone'],
    })
    const edited = await s.roadmapService.update(productId, r.id, fields({ name: 'Renamed' }))
    expect(edited.name).toBe('Renamed')
    expect(edited.defaultView).toBeUndefined() // a save replaces the settings, so cleared fields are cleared
  })

  it('can start with the initiatives, placed in a lane that fits their status', async () => {
    const a = await init('Doing', { status: 'in-progress' })
    const b = await init('Soon', { status: 'planned' })
    const c = await init('Someday', { status: 'idea' })
    await init('Dead', { status: 'dropped' })
    const r = await s.roadmapService.create(productId, fields(), { includeInitiatives: true })
    const lane = (id: string) => r.entries.find((e) => e.itemId === id)?.lane
    expect([lane(a.id), lane(b.id), lane(c.id)]).toEqual(['now', 'next', 'later'])
    expect(r.entries).toHaveLength(3)
  })

  it('rejects an empty name and an empty list of item types', async () => {
    await expect(s.roadmapService.create(productId, fields({ name: '' }))).rejects.toMatchObject({
      code: 'VALIDATION',
    })
    await expect(
      s.roadmapService.create(productId, fields({ itemTypes: [] })),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await s.planning.load(productId)).roadmaps).toHaveLength(0)
  })

  it('deleting archives the roadmap and leaves the items; restore brings it back', async () => {
    const i = await init('Beta')
    const r = await s.roadmapService.create(productId, fields())
    await s.roadmapService.addItems(productId, r.id, [
      { itemType: 'initiative', itemId: i.id, lane: 'now' },
    ])
    await s.roadmapService.delete(productId, r.id)
    expect((await s.planning.load(productId)).roadmaps.filter((x) => !x.deletedAt)).toHaveLength(0)
    expect(await s.initiatives.get(i.id)).toBeTruthy()
    await s.roadmapService.restore(productId, r.id)
    expect((await s.roadmaps.get(r.id))?.entries).toHaveLength(1)
  })

  it('will not touch a roadmap from another product', async () => {
    const other = await s.products.create({ name: 'Other' })
    const r = await s.roadmapService.create(other.id, fields())
    await expect(s.roadmapService.update(productId, r.id, fields())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    await expect(s.roadmapService.delete(productId, r.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

describe('entries: one shared list, never duplicated', () => {
  it('adds items, numbering them after the existing ones, and ignores duplicates', async () => {
    const a = await init('A')
    const f = await feat('F', { initiativeId: a.id })
    const r = await s.roadmapService.create(productId, fields())
    await s.roadmapService.addItems(productId, r.id, [
      { itemType: 'initiative', itemId: a.id, lane: 'now' },
    ])
    const saved = await s.roadmapService.addItems(productId, r.id, [
      { itemType: 'initiative', itemId: a.id, lane: 'later' }, // already there: left where it is
      { itemType: 'feature', itemId: f.id, lane: 'next' },
      { itemType: 'feature', itemId: f.id, lane: 'next' }, // twice in one call
    ])
    expect(saved.entries.map((e) => [e.itemId, e.lane, e.order])).toEqual([
      [a.id, 'now', 1],
      [f.id, 'next', 2],
    ])
  })

  it('the same item can be on two roadmaps, and editing it shows on both (one record)', async () => {
    const a = await init('A')
    const r1 = await s.roadmapService.create(productId, fields({ name: 'One' }))
    const r2 = await s.roadmapService.create(productId, fields({ name: 'Two' }))
    for (const r of [r1, r2])
      await s.roadmapService.addItems(productId, r.id, [
        { itemType: 'initiative', itemId: a.id, lane: 'now' },
      ])
    await s.planning.patchInitiative(productId, a.id, { status: 'shipped' })
    expect((await s.initiatives.get(a.id))?.status).toBe('shipped')
    expect((await s.initiatives.list()).filter((i) => i.title === 'A')).toHaveLength(1)
  })

  it('rejects items that are missing, archived, foreign or of a hidden type', async () => {
    const other = await s.products.create({ name: 'Other' })
    const foreign = await s.planning.saveInitiative(other.id, {
      title: 'Theirs',
      status: 'idea',
      tagIds: [],
    })
    const gone = await init('Gone')
    await s.planning.deleteInitiative(productId, gone.id, 'unlink')
    const r = await s.roadmapService.create(productId, fields())
    for (const itemId of ['ghost', foreign.id, gone.id]) {
      await expect(
        s.roadmapService.addItems(productId, r.id, [{ itemType: 'initiative', itemId }]),
      ).rejects.toMatchObject({ code: 'VALIDATION' })
    }
    const initiativesOnly = await s.roadmapService.create(
      productId,
      fields({ name: 'Slim', itemTypes: ['initiative'] }),
    )
    const f = await feat('F')
    await expect(
      s.roadmapService.addItems(productId, initiativesOnly.id, [
        { itemType: 'feature', itemId: f.id },
      ]),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await s.roadmaps.get(r.id))?.entries).toEqual([])
  })

  it('removes items from the roadmap without touching the items', async () => {
    const a = await init('A')
    const r = await s.roadmapService.create(productId, fields())
    await s.roadmapService.addItems(productId, r.id, [
      { itemType: 'initiative', itemId: a.id, lane: 'now' },
    ])
    await s.roadmapService.removeItems(productId, r.id, [{ itemType: 'initiative', itemId: a.id }])
    expect((await s.roadmaps.get(r.id))?.entries).toEqual([])
    expect(await s.initiatives.get(a.id)).toBeTruthy()
  })

  it('setEntries replaces placement atomically and validates it', async () => {
    const a = await init('A')
    const b = await init('B')
    const r = await s.roadmapService.create(productId, fields())
    await s.roadmapService.setEntries(productId, r.id, [
      { itemType: 'initiative', itemId: b.id, lane: 'next', order: 1 },
      { itemType: 'initiative', itemId: a.id, lane: 'now', order: 2 },
    ])
    expect((await s.roadmaps.get(r.id))?.entries.map((e) => e.itemId)).toEqual([b.id, a.id])
    await expect(
      s.roadmapService.setEntries(productId, r.id, [
        { itemType: 'initiative', itemId: a.id, order: 1 },
        { itemType: 'initiative', itemId: a.id, order: 2 },
      ]),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await s.roadmaps.get(r.id))?.entries).toHaveLength(2) // the failed write changed nothing
  })

  it('deleting an item takes it off every roadmap', async () => {
    const a = await init('A')
    const r1 = await s.roadmapService.create(productId, fields({ name: 'One' }))
    const r2 = await s.roadmapService.create(productId, fields({ name: 'Two' }))
    for (const r of [r1, r2])
      await s.roadmapService.addItems(productId, r.id, [
        { itemType: 'initiative', itemId: a.id, lane: 'now' },
      ])
    await s.planning.deleteInitiative(productId, a.id, 'unlink')
    expect((await s.roadmaps.get(r1.id))?.entries).toEqual([])
    expect((await s.roadmaps.get(r2.id))?.entries).toEqual([])
  })
})

describe('view settings', () => {
  it("saves a view's own config without touching the roadmap or the other views", async () => {
    const r = await s.roadmapService.create(productId, fields())
    const { views } = await s.planning.load(productId)
    const board = views.find((v) => v.layout === 'board')!
    const timeline = views.find((v) => v.layout === 'timeline')!
    await s.roadmapService.saveView(productId, board.id, {
      groupBy: 'priority',
      cardFields: ['owner'],
    })
    expect((await s.roadmapViews.get(board.id))?.config).toEqual({
      groupBy: 'priority',
      cardFields: ['owner'],
    })
    expect((await s.roadmapViews.get(timeline.id))?.config).toEqual({})
    expect((await s.roadmaps.get(r.id))?.entries).toEqual([])
  })
  it('rejects a grouping that does not exist', async () => {
    await s.roadmapService.create(productId, fields())
    const board = (await s.planning.load(productId)).views.find((v) => v.layout === 'board')!
    await expect(
      s.roadmapService.saveView(productId, board.id, { groupBy: 'nonsense' as never }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('ensureViews fills in missing views once', async () => {
    const r = await s.roadmapService.create(productId, fields())
    const timeline = (await s.planning.load(productId)).views.find((v) => v.layout === 'timeline')!
    await s.roadmapViews.remove(timeline.id)
    await s.roadmapService.ensureViews(productId, r.id)
    await s.roadmapService.ensureViews(productId, r.id)
    expect(
      (await s.planning.load(productId)).views.filter((v) => v.roadmapId === r.id),
    ).toHaveLength(3)
  })
})

describe('quick edits on items', () => {
  it('patches only the given fields and clears fields set to undefined', async () => {
    const a = await init('A', {
      priority: 'high',
      owner: 'Sam',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })
    const p = await s.planning.patchInitiative(productId, a.id, {
      status: 'planned',
      owner: undefined,
    })
    expect(p).toMatchObject({ status: 'planned', priority: 'high', startDate: '2026-11-01' })
    expect(p.owner).toBeUndefined()
  })
  it('validates dates and parents, and a bad patch writes nothing', async () => {
    const a = await init('A')
    await expect(
      s.planning.patchInitiative(productId, a.id, {
        startDate: '2026-12-05',
        endDate: '2026-12-01',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      s.planning.patchInitiative(productId, a.id, { objectiveId: 'ghost' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    const f = await feat('F')
    await expect(
      s.planning.patchFeature(productId, f.id, { initiativeId: 'ghost' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await s.initiatives.get(a.id))?.startDate).toBeUndefined()
  })
  it('moves a feature to another initiative', async () => {
    const a = await init('A')
    const b = await init('B')
    const f = await feat('F', { initiativeId: a.id })
    expect(
      (await s.planning.patchFeature(productId, f.id, { initiativeId: b.id })).initiativeId,
    ).toBe(b.id)
  })
})

describe('milestones', () => {
  it('creates, edits, links and deletes', async () => {
    const a = await init('A')
    const m = await s.planning.saveMilestone(productId, {
      title: 'Beta',
      date: '2026-12-01',
      status: 'upcoming',
      initiativeId: a.id,
    })
    const edited = await s.planning.saveMilestone(
      productId,
      { title: 'Beta live', date: '2026-12-15', status: 'reached' },
      m.id,
    )
    expect(edited).toMatchObject({ title: 'Beta live', status: 'reached' })
    expect(edited.initiativeId).toBeUndefined()
    await s.planning.deleteMilestone(productId, m.id)
    expect((await s.planning.load(productId)).milestones.filter((x) => !x.deletedAt)).toHaveLength(
      0,
    )
  })
  it('rejects a bad date and an unknown initiative', async () => {
    await expect(
      s.planning.saveMilestone(productId, { title: 'X', date: 'tomorrow', status: 'upcoming' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      s.planning.saveMilestone(productId, {
        title: 'X',
        date: '2026-01-01',
        status: 'upcoming',
        initiativeId: 'ghost',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('dependencies', () => {
  const link = (
    fromId: string,
    toId: string,
    kind: 'blocks' | 'relates' = 'blocks',
    types: ['initiative' | 'feature', 'initiative' | 'feature'] = ['initiative', 'initiative'],
  ) =>
    s.planning.saveDependency(productId, {
      fromType: types[0],
      fromId,
      toType: types[1],
      toId,
      kind,
    })

  it('links items across kinds and removes links', async () => {
    const a = await init('A')
    const f = await feat('F')
    const d = await link(a.id, f.id, 'blocks', ['initiative', 'feature'])
    expect((await s.planning.load(productId)).dependencies).toHaveLength(1)
    await s.planning.deleteDependency(productId, d.id)
    expect((await s.planning.load(productId)).dependencies).toHaveLength(0)
  })
  it('refuses duplicates, including the mirror of a "relates" link', async () => {
    const a = await init('A')
    const b = await init('B')
    await link(a.id, b.id)
    await expect(link(a.id, b.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await link(a.id, b.id, 'relates')
    await expect(link(b.id, a.id, 'relates')).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('refuses a blocks link that would close a loop, direct or long', async () => {
    const [a, b, c] = [await init('A'), await init('B'), await init('C')]
    await link(a.id, b.id)
    await link(b.id, c.id)
    await expect(link(b.id, a.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(link(c.id, a.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await link(c.id, a.id, 'relates') // a "relates" link is not ordering, so it is fine
  })
  it('refuses links to itself, to missing items and to another product', async () => {
    const other = await s.products.create({ name: 'Other' })
    const foreign = await s.planning.saveInitiative(other.id, {
      title: 'T',
      status: 'idea',
      tagIds: [],
    })
    const a = await init('A')
    await expect(link(a.id, a.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(link(a.id, 'ghost')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(link(a.id, foreign.id)).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('deleting an item removes its links', async () => {
    const a = await init('A')
    const b = await init('B')
    await link(a.id, b.id)
    await s.planning.deleteInitiative(productId, a.id, 'unlink')
    expect((await s.planning.load(productId)).dependencies).toHaveLength(0)
  })
})
