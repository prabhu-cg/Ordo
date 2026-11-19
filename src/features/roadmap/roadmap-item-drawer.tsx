import { Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/input'
import {
  LANES,
  PRIORITIES,
  WORK_STATUSES,
  type Dependency,
  type Feature,
  type Initiative,
  type Lane,
  type Priority,
  type WorkStatus,
} from '@/domain'
import { formatDate } from '@/lib/format'
import {
  LANE_LABELS,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from '@/lib/labels'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { addDependency, moveRow, removeDependency, removeRow, updateItem } from './actions'
import { today } from './dates'
import { buildRows, effectiveLane, rowKey, type ItemType } from './engine'

interface Props {
  roadmapId: string
  itemType: ItemType
  itemId: string
}

const KIND_LABEL = {
  blocks: 'Blocks',
  'blocked-by': 'Is blocked by',
  relates: 'Relates to',
} as const
type LinkChoice = keyof typeof KIND_LABEL

/**
 * Everything about one card on a roadmap, with the common edits right here. The same record opens from
 * any view, and every change goes through the shared data, so all three views update behind it.
 */
export function RoadmapItemDrawer({ roadmapId, itemType, itemId }: Props) {
  const { roadmaps, initiatives, features, objectives, dependencies, tags } = usePlanningStore()
  const { closeRoadmapItem, open } = useItemDrawer()
  const roadmap = roadmaps.find((r) => r.id === roadmapId)
  const row = useMemo(
    () =>
      roadmap
        ? buildRows(roadmap, initiatives, features).find((r) => r.key === rowKey(itemType, itemId))
        : undefined,
    [roadmap, initiatives, features, itemType, itemId],
  )
  const gone = !row
  useEffect(() => {
    if (gone) closeRoadmapItem() // it was deleted or taken off the roadmap
  }, [gone, closeRoadmapItem])

  const [linkKind, setLinkKind] = useState<LinkChoice>('blocks')
  const [linkTo, setLinkTo] = useState('')
  if (!row || !roadmap) return null

  const item = row.item
  const initiative = itemType === 'initiative' ? (item as Initiative) : undefined
  const feature = itemType === 'feature' ? (item as Feature) : undefined
  const parent = feature ? initiatives.find((i) => i.id === feature.initiativeId) : undefined
  const objective = objectives.find((o) => o.id === (initiative ?? parent)?.objectiveId)
  const mode = roadmap.planningMode
  const lane = effectiveLane(row, mode, today())
  const tagList = item.tagIds.map((id) => tags.find((t) => t.id === id)).filter((t) => Boolean(t))

  const titleOf = (type: ItemType, id: string) =>
    (type === 'initiative'
      ? initiatives.find((i) => i.id === id)?.title
      : features.find((f) => f.id === id)?.title) ?? 'Removed item'
  const mine = (d: Dependency) =>
    (d.fromType === itemType && d.fromId === itemId) || (d.toType === itemType && d.toId === itemId)
  const links = dependencies.filter(mine)
  const blockedBy = links.filter(
    (d) => d.kind === 'blocks' && d.toType === itemType && d.toId === itemId,
  )
  const blocks = links.filter(
    (d) => d.kind === 'blocks' && d.fromType === itemType && d.fromId === itemId,
  )
  const related = links.filter((d) => d.kind === 'relates')

  const candidates = [
    ...initiatives
      .filter((i) => !(itemType === 'initiative' && i.id === itemId))
      .map((i) => ({ value: `initiative:${i.id}`, label: `${i.title} (initiative)` })),
    ...features
      .filter((f) => !(itemType === 'feature' && f.id === itemId))
      .map((f) => ({ value: `feature:${f.id}`, label: `${f.title} (feature)` })),
  ]

  async function addLink(e: React.FormEvent) {
    e.preventDefault()
    if (!linkTo) return
    const [otherType, otherId] = linkTo.split(':') as [ItemType, string]
    const self = { type: itemType, id: itemId }
    const other = { type: otherType, id: otherId }
    const [from, to] = linkKind === 'blocked-by' ? [other, self] : [self, other]
    const ok = await addDependency({
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
      kind: linkKind === 'relates' ? 'relates' : 'blocks',
    })
    if (ok) setLinkTo('')
  }

  const linkList = (title: string, list: Dependency[], otherSide: 'from' | 'to') =>
    list.length > 0 && (
      <div>
        <h4 className="text-label font-semibold text-muted-foreground">{title}</h4>
        <ul className="mt-1 divide-y border-y">
          {list.map((d) => {
            const otherType = otherSide === 'from' ? d.fromType : d.toType
            const otherId = otherSide === 'from' ? d.fromId : d.toId
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-body text-foreground">
                  {titleOf(otherType, otherId)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={() => void removeDependency(d)}
                  aria-label={`Remove link to ${titleOf(otherType, otherId)}`}
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
    )

  const dates =
    item.startDate && item.endDate
      ? `${formatDate(item.startDate)} to ${formatDate(item.endDate)}`
      : item.startDate
        ? `From ${formatDate(item.startDate)}`
        : item.endDate
          ? `Until ${formatDate(item.endDate)}`
          : 'No dates'
  const score = (v?: number) => (v === undefined ? 'Not set' : `${v} of 5`)

  const facts: [string, React.ReactNode][] = [
    ['Objective', objective?.title ?? 'None'],
    ...(feature ? ([['Initiative', parent?.title ?? 'None']] as [string, React.ReactNode][]) : []),
    ['Owner', item.owner ?? 'Not set'],
    [
      'Dates',
      <span key="d" className="tabular-nums">
        {dates}
      </span>,
    ],
    ['Impact', score(item.scoring?.impact)],
    ...(initiative
      ? ([['Confidence', score(item.scoring?.confidence)]] as [string, React.ReactNode][])
      : []),
    ['Effort', score(item.scoring?.effort)],
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>{item.title}</DrawerTitle>
        <DrawerDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE[item.status]}>{STATUS_LABELS[item.status]}</Badge>
            {item.priority && (
              <Badge variant={PRIORITY_BADGE[item.priority]}>
                {PRIORITY_LABELS[item.priority]}
              </Badge>
            )}
            <span className="text-caption text-muted-foreground">
              {feature ? 'Feature' : 'Initiative'} on “{roadmap.name}”
            </span>
          </div>
        </DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-8">
        <section aria-labelledby="ri-details" className="flex flex-col gap-4">
          <h3 id="ri-details" className="text-title font-semibold text-foreground">
            Details
          </h3>
          {item.description ? (
            <p className="max-w-prose text-[0.9375rem] leading-7">{item.description}</p>
          ) : (
            <p className="text-body text-muted-foreground">No description yet.</p>
          )}
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-label font-semibold text-muted-foreground">{k}</dt>
                <dd className="text-body text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          {tagList.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {tagList.map((t) => (
                <li key={t!.id}>
                  <Badge variant="outline">{t!.name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ri-plan" className="flex flex-col gap-4">
          <h3 id="ri-plan" className="text-title font-semibold text-foreground">
            Change it here
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status">
              {(c) => (
                <Select
                  {...c}
                  value={item.status}
                  onChange={(e) =>
                    void updateItem(
                      row,
                      { status: e.target.value as WorkStatus },
                      `Status of “${item.title}” set to ${STATUS_LABELS[e.target.value as WorkStatus]}`,
                    )
                  }
                >
                  {WORK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(c) => (
                <Select
                  {...c}
                  value={item.priority ?? ''}
                  onChange={(e) =>
                    void updateItem(
                      row,
                      { priority: (e.target.value || undefined) as Priority | undefined },
                      `Priority of “${item.title}” changed`,
                    )
                  }
                >
                  <option value="">Not set</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Column"
              hint={mode === 'dates' && item.startDate ? 'Follows its dates.' : undefined}
            >
              {(c) => (
                <Select
                  {...c}
                  value={lane ?? ''}
                  onChange={(e) =>
                    void moveRow({
                      roadmapId,
                      row,
                      lane: (e.target.value || null) as Lane | null,
                      mode,
                      label: `Moved “${item.title}” to ${e.target.value ? LANE_LABELS[e.target.value as Lane] : 'not placed'}`,
                    })
                  }
                >
                  {!lane && <option value="">Not placed</option>}
                  {LANES.map((l) => (
                    <option key={l} value={l}>
                      {LANE_LABELS[l]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </section>

        <section aria-labelledby="ri-links" className="flex flex-col gap-4">
          <h3 id="ri-links" className="text-title font-semibold text-foreground">
            Dependencies
          </h3>
          {links.length === 0 && (
            <p className="text-body text-muted-foreground">
              Nothing is linked to this yet. Use links when one piece of work has to finish before
              another can start.
            </p>
          )}
          {linkList('Blocked by', blockedBy, 'from')}
          {linkList('Blocks', blocks, 'to')}
          {linkList('Related', related, related[0]?.fromId === itemId ? 'to' : 'from')}
          <form onSubmit={addLink} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Add a link" className="sm:w-44">
              {(c) => (
                <Select
                  {...c}
                  value={linkKind}
                  onChange={(e) => setLinkKind(e.target.value as LinkChoice)}
                >
                  {(Object.keys(KIND_LABEL) as LinkChoice[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Item" className="flex-1">
              {(c) => (
                <Select {...c} value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
                  <option value="">Choose an item</option>
                  {candidates.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button type="submit" variant="outline" disabled={!linkTo}>
              Add link
            </Button>
          </form>
        </section>
      </DrawerBody>
      <DrawerFooter className="justify-between">
        <Button
          variant="destructive"
          onClick={() => void removeRow(roadmapId, row).then((ok) => ok && closeRoadmapItem())}
        >
          <Trash2 aria-hidden /> Remove from roadmap
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={closeRoadmapItem}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              closeRoadmapItem()
              open({ kind: itemType, id: itemId })
            }}
          >
            Edit all details
          </Button>
        </div>
      </DrawerFooter>
    </div>
  )
}
