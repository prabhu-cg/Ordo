import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LANES, type Lane, type PlanningMode } from '@/domain'
import { LANE_LABELS, STATUS_LABELS } from '@/lib/labels'
import { useBindings } from './bindings'
import { today } from './dates'
import { DragBoard, type BoardColumnSpec } from './drag-board'
import { effectiveLane, type RoadmapRow } from './engine'
import type { CardField } from './card-fields'
import { RoadmapCard } from './roadmap-card'
import type { useRoadmapData } from './use-roadmap'

type Data = ReturnType<typeof useRoadmapData>
const FIELDS = new Set<CardField>(['priority', 'confidence', 'dependencies', 'dates'])

/**
 * Now, next, later. Three flexible columns: drag cards between them or within them, or use the quick-edit
 * menu. It reads the same rows as the timeline and board; moving a card changes the shared placement.
 */
export function NowNextLaterView({ data }: { data: Data }) {
  const { roadmap, filtered, initiatives } = data
  const { moveRow, updateItem, removeRow, openItem: openRoadmapItem, openAdd } = useBindings()
  const mode: PlanningMode | undefined = roadmap!.planningMode
  const now = today()

  const laneOf = (row: RoadmapRow): Lane | 'none' => effectiveLane(row, mode, now) ?? 'none'
  const byKey = useMemo(() => new Map(filtered.map((r) => [r.key, r])), [filtered])

  const columns: BoardColumnSpec[] = useMemo(() => {
    const cols: BoardColumnSpec[] = LANES.map((lane) => ({
      id: lane,
      label: LANE_LABELS[lane],
      keys: filtered.filter((r) => laneOf(r) === lane).map((r) => r.key),
      emptyText:
        lane === 'now' ? 'Nothing in progress. Drag a card here.' : 'Drag a card here, or add one.',
      header: (
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-body font-semibold text-foreground">{LANE_LABELS[lane]}</h3>
            <span className="text-caption text-muted-foreground tabular-nums">
              {filtered.filter((r) => laneOf(r) === lane).length}
            </span>
          </div>
          {openAdd && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              onClick={() => openAdd(roadmap!.id, lane)}
              aria-label={`Add items to ${LANE_LABELS[lane]}`}
            >
              <Plus aria-hidden />
            </Button>
          )}
        </div>
      ),
    }))
    const unplaced = filtered.filter((r) => laneOf(r) === 'none')
    if (unplaced.length > 0)
      cols.push({ id: 'none', label: 'Not placed yet', keys: unplaced.map((r) => r.key) })
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, mode, roadmap])

  const titleOf = (key: string) => byKey.get(key)?.item.title ?? 'card'

  return (
    <div className="flex flex-col gap-4">
      {mode === 'dates' ? (
        <Alert tone="info" title="This roadmap follows dates">
          Now is this month and next, next is the three months after, and later is beyond. Moving a
          dated card to another column changes its dates, and the timeline follows. Undated cards
          stay where you put them.
        </Alert>
      ) : (
        <p className="text-caption text-muted-foreground">
          Columns are yours to set: dates are optional and moving a card does not change them.
        </p>
      )}
      <DragBoard
        className="md:grid-cols-3"
        columns={columns}
        describe={(key) => `${titleOf(key)}, ${byKey.get(key)?.kind ?? 'item'}`}
        onDrop={(key, drop, columnId) => {
          const row = byKey.get(key)
          if (!row) return
          const lane = columnId === 'none' ? null : (columnId as Lane)
          const moved = laneOf(row) !== columnId
          void moveRow({
            roadmapId: roadmap!.id,
            row,
            drop,
            lane,
            mode,
            label: moved
              ? `Moved “${row.item.title}” to ${lane ? LANE_LABELS[lane] : 'not placed'}`
              : `Reordered “${row.item.title}”`,
          })
        }}
        renderCard={(key, state) => {
          const row = byKey.get(key)
          if (!row) return null
          const lane = laneOf(row)
          const parent =
            row.kind === 'feature'
              ? initiatives.find(
                  (i) => i.id === (row.item as { initiativeId?: string }).initiativeId,
                )
              : undefined
          return (
            <RoadmapCard
              row={row}
              fields={FIELDS}
              links={data.links.get(row.key)}
              parentTitle={parent?.title}
              lane={lane === 'none' ? undefined : lane}
              overlay={state.overlay}
              handleProps={state.handleProps?.handleProps}
              onOpen={() => openRoadmapItem(roadmap!.id, row.kind, row.item.id)}
              quick={{
                onOpen: () => openRoadmapItem(roadmap!.id, row.kind, row.item.id),
                onStatus: (status) =>
                  void updateItem(
                    row,
                    { status },
                    `Status of “${row.item.title}” set to ${STATUS_LABELS[status]}`,
                  ),
                onPriority: (priority) =>
                  void updateItem(row, { priority }, `Priority of “${row.item.title}” changed`),
                onLane: (to) => {
                  const last = filtered.filter((r) => laneOf(r) === to && r.key !== row.key).at(-1)
                  void moveRow({
                    roadmapId: roadmap!.id,
                    row,
                    lane: to,
                    mode,
                    drop: { anchorKey: last?.key, place: 'after' },
                    label: `Moved “${row.item.title}” to ${LANE_LABELS[to]}`,
                  })
                },
                onRemove: () => void removeRow(roadmap!.id, row),
              }}
            />
          )
        }}
      />
    </div>
  )
}
