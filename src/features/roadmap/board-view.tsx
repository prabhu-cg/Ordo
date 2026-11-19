import { SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/input'
import type { Feature, Initiative } from '@/domain'
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/labels'
import { useItemDrawer } from '@/store/drawer-store'
import { moveRow, removeRow, saveViewConfig, updateItem } from './actions'
import { DragBoard } from './drag-board'
import { boardColumns, groupPatch, type GroupBy } from './engine'
import { CARD_FIELD_LABELS, DEFAULT_CARD_FIELDS, type CardField } from './card-fields'
import { RoadmapCard } from './roadmap-card'
import type { useRoadmapData } from './use-roadmap'

type Data = ReturnType<typeof useRoadmapData>

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'initiative', label: 'Initiative' },
]
const SORTS = [
  { value: 'manual', label: 'Your order' },
  { value: 'priority', label: 'Priority, highest first' },
  { value: 'impact', label: 'Impact, highest first' },
  { value: 'effort', label: 'Effort, lowest first' },
  { value: 'title', label: 'Title, A to Z' },
  { value: 'updated', label: 'Recently updated' },
]
const isGroup = (v: unknown): v is GroupBy => GROUPS.some((g) => g.value === v)

/**
 * The board. Group the same cards by status, priority or initiative; dragging a card to another column
 * changes that field on the item itself, so every other view agrees straight away.
 */
export function BoardView({ data }: { data: Data }) {
  const { roadmap, filtered, initiatives, objectives, tags, views } = data
  const openRoadmapItem = useItemDrawer((s) => s.openRoadmapItem)
  const view = views.find((v) => v.layout === 'board')
  const config = view?.config ?? {}
  const groupBy: GroupBy = isGroup(config.groupBy) ? config.groupBy : 'status'
  const sort = config.sort ?? 'manual'
  const fields = useMemo(
    () => new Set<CardField>(config.cardFields ?? DEFAULT_CARD_FIELDS),
    [config.cardFields],
  )

  const columns = useMemo(
    () => boardColumns(filtered, groupBy, initiatives, sort),
    [filtered, groupBy, initiatives, sort],
  )
  const byKey = useMemo(() => new Map(filtered.map((r) => [r.key, r])), [filtered])
  const manual = sort === 'manual'

  const save = (patch: Partial<typeof config>) =>
    view && void saveViewConfig(view.id, { ...config, ...patch })

  const initiativeOf = (id?: string) => initiatives.find((i) => i.id === id)
  const objectiveTitle = (row: { kind: string; item: Initiative | Feature }) => {
    const initiative =
      row.kind === 'initiative'
        ? (row.item as Initiative)
        : initiativeOf((row.item as Feature).initiativeId)
    return objectives.find((o) => o.id === initiative?.objectiveId)?.title
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Group by" className="w-44">
          {(c) => (
            <Select
              {...c}
              value={groupBy}
              onChange={(e) => save({ groupBy: e.target.value as GroupBy })}
            >
              {GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sort cards by" className="w-52">
          {(c) => (
            <Select
              {...c}
              value={sort}
              onChange={(e) => save({ sort: e.target.value as typeof sort })}
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal aria-hidden /> Customise cards
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Show on each card</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(CARD_FIELD_LABELS) as CardField[]).map((f) => (
              <DropdownMenuCheckboxItem
                key={f}
                checked={fields.has(f)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(on) =>
                  save({
                    cardFields: (Object.keys(CARD_FIELD_LABELS) as CardField[]).filter((x) =>
                      x === f ? on : fields.has(x),
                    ),
                  })
                }
              >
                {CARD_FIELD_LABELS[f]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!manual && (
        <p className="text-caption text-muted-foreground">
          Cards are sorted, so dropping one changes its {groupBy} but not its position. Choose “Your
          order” to place cards by hand.
        </p>
      )}
      {groupBy === 'initiative' && (
        <p className="text-caption text-muted-foreground">
          Columns are initiatives and cards are their features. Drag a feature to another initiative
          to move it.
        </p>
      )}

      <DragBoard
        className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        showInsertion={manual}
        columns={columns.map((c) => ({ id: c.id, label: c.label, keys: c.rows.map((r) => r.key) }))}
        describe={(key) =>
          `${byKey.get(key)?.item.title ?? 'card'}, ${byKey.get(key)?.kind ?? 'item'}`
        }
        onDrop={(key, drop, columnId) => {
          const row = byKey.get(key)
          const column = columns.find((c) => c.id === columnId)
          if (!row || !column) return
          const patch = groupPatch(groupBy, column, row)
          void moveRow({
            roadmapId: roadmap!.id,
            row,
            drop,
            reorder: manual,
            itemPatch: patch,
            label: patch
              ? `Moved “${row.item.title}” to ${column.label}`
              : `Reordered “${row.item.title}”`,
          })
        }}
        renderCard={(key, state) => {
          const row = byKey.get(key)
          if (!row) return null
          const parent =
            row.kind === 'feature' ? initiativeOf((row.item as Feature).initiativeId) : undefined
          const open = () => openRoadmapItem(roadmap!.id, row.kind, row.item.id)
          return (
            <RoadmapCard
              row={row}
              fields={fields}
              hideStatus={groupBy === 'status'}
              parentTitle={groupBy === 'initiative' ? undefined : parent?.title}
              objectiveTitle={objectiveTitle(row)}
              tagNames={row.item.tagIds
                .map((id) => tags.find((t) => t.id === id)?.name)
                .filter((n): n is string => Boolean(n))}
              overlay={state.overlay}
              handleProps={state.handleProps?.handleProps}
              onOpen={open}
              quick={{
                onOpen: open,
                onStatus: (status) =>
                  void updateItem(
                    row,
                    { status },
                    `Status of “${row.item.title}” set to ${STATUS_LABELS[status]}`,
                  ),
                onPriority: (priority) =>
                  void updateItem(
                    row,
                    { priority },
                    `Priority of “${row.item.title}” ${priority ? `set to ${PRIORITY_LABELS[priority]}` : 'cleared'}`,
                  ),
                onRemove: () => void removeRow(roadmap!.id, row),
              }}
            />
          )
        }}
      />
    </div>
  )
}
