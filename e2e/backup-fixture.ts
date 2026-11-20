import { randomUUID } from 'node:crypto'

const now = '2026-11-19T10:00:00.000Z'
const base = () => ({ id: randomUUID(), createdAt: now, updatedAt: now })

export interface FixtureProduct {
  name: string
  /** Number of initiatives, each on the roadmap. */
  initiatives?: number
  /** Features under each initiative. */
  features?: number
  /** Give every initiative this title (use to test hostile text). */
  title?: (index: number) => string
  /** Write scores the way version 1 did, as numbers from 1 to 5. */
  v1Scores?: boolean
  /** Link each initiative to the next, so the product has dependencies. */
  chain?: boolean
}

/** A complete, valid backup file, built by hand so tests do not depend on the app to make their input. */
export function buildBackup(products: FixtureProduct[], over: Record<string, unknown> = {}) {
  const data = {
    products: [] as unknown[],
    objectives: [] as unknown[],
    initiatives: [] as unknown[],
    features: [] as unknown[],
    milestones: [] as unknown[],
    roadmaps: [] as unknown[],
    roadmapViews: [] as unknown[],
    tags: [] as unknown[],
    dependencies: [] as unknown[],
    revisions: [] as unknown[],
    templates: [] as unknown[],
  }
  const ids: Record<string, string[]> = {}
  for (const p of products) {
    const product = { ...base(), name: p.name }
    data.products.push(product)
    const objective = {
      ...base(),
      productId: product.id,
      title: 'Grow',
      status: 'active',
      order: 1,
    }
    data.objectives.push(objective)
    const entries: unknown[] = []
    ids[p.name] = []
    for (let i = 0; i < (p.initiatives ?? 3); i++) {
      const scoring = p.v1Scores
        ? { impact: 4, effort: 2, confidence: 5 }
        : { impact: 'high', effort: 'low' }
      const initiative = {
        ...base(),
        productId: product.id,
        objectiveId: objective.id,
        title: p.title ? p.title(i) : `${p.name} initiative ${i + 1}`,
        status: i % 3 === 0 ? 'in-progress' : i % 3 === 1 ? 'planned' : 'idea',
        priority: i % 2 ? 'high' : 'medium',
        scoring,
        tagIds: [],
        startDate: `2026-${String(11 + (i % 2)).padStart(2, '0')}-01`,
        endDate: `2027-0${1 + (i % 6)}-28`,
        order: i + 1,
      }
      data.initiatives.push(initiative)
      ids[p.name]!.push(initiative.id)
      entries.push({
        itemType: 'initiative',
        itemId: initiative.id,
        lane: (['now', 'next', 'later'] as const)[i % 3],
        order: i + 1,
      })
      for (let f = 0; f < (p.features ?? 0); f++)
        data.features.push({
          ...base(),
          productId: product.id,
          initiativeId: initiative.id,
          title: `${p.name} feature ${i + 1}.${f + 1}`,
          status: 'idea',
          tagIds: [],
          order: f + 1,
        })
    }
    if (p.chain)
      ids[p.name]!.slice(0, -1).forEach((id, i) =>
        data.dependencies.push({
          ...base(),
          productId: product.id,
          fromType: 'initiative',
          fromId: id,
          toType: 'initiative',
          toId: ids[p.name]![i + 1],
          kind: 'blocks',
        }),
      )
    const roadmap = {
      ...base(),
      productId: product.id,
      name: 'Roadmap',
      entries,
      defaultView: 'now-next-later',
      planningMode: 'flexible',
    }
    data.roadmaps.push(roadmap)
    ;(['now-next-later', 'timeline', 'board'] as const).forEach((layout, n) =>
      data.roadmapViews.push({
        ...base(),
        productId: product.id,
        roadmapId: roadmap.id,
        name: layout,
        layout,
        config: {},
        order: n + 1,
      }),
    )
  }
  return { app: 'ordo', schemaVersion: 2, exportedAt: now, data, ...over }
}

export const asFile = (backup: unknown, name = 'backup.json') => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(backup)),
})

/** Width and height of a PNG, read from its header. */
export function pngSize(buffer: Buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error('Not a PNG file')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}
