import type { Feature, Initiative, Level, Objective, Priority, Tag, WorkStatus } from '@/domain'
import { WORK_STATUSES, objectiveProgress } from '@/domain'
import { LEVEL_RANK, STATUS_LABELS } from '@/lib/labels'

/** Values the toolbar can hold. Empty string means "any". */
export interface Filters {
  q: string
  status: string
  priority: string
  objective: string
  initiative: string
  tag: string
  sort: string
}
export const NONE = 'none' // "not set" for priority, objective and initiative filters

export const EMPTY_FILTERS: Filters = {
  q: '',
  status: '',
  priority: '',
  objective: '',
  initiative: '',
  tag: '',
  sort: 'manual',
}

export const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual order' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'title', label: 'Title, A to Z' },
  { value: 'priority', label: 'Priority, highest first' },
  { value: 'status', label: 'Status' },
  { value: 'impact', label: 'Impact, highest first' },
  { value: 'effort', label: 'Effort, lowest first' },
] as const
export const OBJECTIVE_SORT_OPTIONS = [
  { value: 'manual', label: 'Manual order' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'title', label: 'Title, A to Z' },
  { value: 'target', label: 'Target date, soonest first' },
  { value: 'progress', label: 'Progress, least first' },
] as const

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
/** Active work first, finished and dropped last. */
const STATUS_RANK: Record<WorkStatus, number> = {
  'in-progress': 0,
  planned: 1,
  idea: 2,
  paused: 3,
  shipped: 4,
  dropped: 5,
}

interface Sortable {
  title: string
  order: number
  updatedAt: string
  status: string
  priority?: Priority
  scoring?: { impact?: Level; effort?: Level }
}

const compareTitle = (a: { title: string }, b: { title: string }) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
/** Sort items with a missing value after those that have one, in either direction. */
function byOptional(a: number | undefined, b: number | undefined, dir: 1 | -1) {
  if (a === undefined && b === undefined) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return (a - b) * dir
}

export function sortItems<T extends Sortable>(items: T[], sort: string): T[] {
  const out = [...items]
  const tie = (a: T, b: T) => a.order - b.order
  switch (sort) {
    case 'updated':
      return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || tie(a, b))
    case 'title':
      return out.sort((a, b) => compareTitle(a, b) || tie(a, b))
    case 'priority':
      return out.sort(
        (a, b) =>
          byOptional(
            a.priority && PRIORITY_RANK[a.priority],
            b.priority && PRIORITY_RANK[b.priority],
            1,
          ) || tie(a, b),
      )
    case 'status':
      return out.sort(
        (a, b) =>
          (STATUS_RANK[a.status as WorkStatus] ?? 9) - (STATUS_RANK[b.status as WorkStatus] ?? 9) ||
          tie(a, b),
      )
    case 'impact':
      return out.sort(
        (a, b) =>
          byOptional(
            a.scoring?.impact && LEVEL_RANK[a.scoring.impact],
            b.scoring?.impact && LEVEL_RANK[b.scoring.impact],
            -1,
          ) || tie(a, b),
      )
    case 'effort':
      return out.sort(
        (a, b) =>
          byOptional(
            a.scoring?.effort && LEVEL_RANK[a.scoring.effort],
            b.scoring?.effort && LEVEL_RANK[b.scoring.effort],
            1,
          ) || tie(a, b),
      )
    default:
      return out.sort(tie)
  }
}

const norm = (s: string) => s.toLowerCase()
const matchesText = (haystack: (string | undefined)[], q: string) => {
  const needle = norm(q.trim())
  return needle === '' || haystack.some((h) => h && norm(h).includes(needle))
}
const matchesPriority = (p: Priority | undefined, f: string) =>
  f === '' || (f === NONE ? !p : p === f)

interface Context {
  objectives: Objective[]
  initiatives: Initiative[]
  tags: Tag[]
}

const tagNames = (ids: string[], tags: Tag[]) =>
  ids.map((id) => tags.find((t) => t.id === id)?.name)

export function filterInitiatives(items: Initiative[], ctx: Context, f: Filters): Initiative[] {
  const objectiveTitle = (id?: string) => ctx.objectives.find((o) => o.id === id)?.title
  const kept = items.filter(
    (i) =>
      matchesText(
        [
          i.title,
          i.description,
          i.owner,
          objectiveTitle(i.objectiveId),
          ...tagNames(i.tagIds, ctx.tags),
        ],
        f.q,
      ) &&
      (f.status === '' || i.status === f.status) &&
      matchesPriority(i.priority, f.priority) &&
      (f.objective === '' ||
        (f.objective === NONE ? !i.objectiveId : i.objectiveId === f.objective)) &&
      (f.tag === '' || i.tagIds.includes(f.tag)),
  )
  return sortItems(kept, f.sort)
}

export function filterFeatures(items: Feature[], ctx: Context, f: Filters): Feature[] {
  const initiativeOf = (id?: string) => ctx.initiatives.find((i) => i.id === id)
  const kept = items.filter((x) => {
    const parent = initiativeOf(x.initiativeId)
    const objectiveId = parent?.objectiveId
    return (
      matchesText(
        [x.title, x.description, x.owner, parent?.title, ...tagNames(x.tagIds, ctx.tags)],
        f.q,
      ) &&
      (f.status === '' || x.status === f.status) &&
      matchesPriority(x.priority, f.priority) &&
      (f.initiative === '' ||
        (f.initiative === NONE ? !x.initiativeId : x.initiativeId === f.initiative)) &&
      (f.objective === '' || (f.objective === NONE ? !objectiveId : objectiveId === f.objective)) &&
      (f.tag === '' || x.tagIds.includes(f.tag))
    )
  })
  return sortItems(kept, f.sort)
}

export function filterObjectives(items: Objective[], f: Filters): Objective[] {
  const kept = items.filter(
    (o) =>
      matchesText(
        [o.title, o.description, ...(o.outcomes ?? []).flatMap((x) => [x.title, x.metric])],
        f.q,
      ) &&
      (f.status === '' || o.status === f.status),
  )
  if (f.sort === 'target') {
    return [...kept].sort(
      (a, b) =>
        (a.targetDate && b.targetDate
          ? a.targetDate.localeCompare(b.targetDate)
          : a.targetDate
            ? -1
            : b.targetDate
              ? 1
              : 0) || a.order - b.order,
    )
  }
  if (f.sort === 'progress') {
    return [...kept].sort(
      (a, b) => byOptional(objectiveProgress(a), objectiveProgress(b), 1) || a.order - b.order,
    )
  }
  return sortItems(kept, f.sort)
}

/** How many filters (not counting sort) are narrowing the list. */
export const activeFilterCount = (f: Filters) =>
  [f.q.trim(), f.status, f.priority, f.objective, f.initiative, f.tag].filter(Boolean).length

export const WORK_STATUS_OPTIONS = WORK_STATUSES.map((s) => ({
  value: s as string,
  label: STATUS_LABELS[s],
}))
