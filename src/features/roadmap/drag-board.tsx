import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { resolveDrop, type Drop } from './engine'

export interface BoardColumnSpec {
  id: string
  label: string
  keys: string[]
  header?: React.ReactNode
  emptyText?: string
}

export interface CardState {
  /** The copy that follows the pointer. */
  overlay?: boolean
  /** Give these to the part of the card that picks it up. */
  handleProps?: HandleProps
}

interface Props {
  columns: BoardColumnSpec[]
  /** Describe a card for screen readers. */
  describe: (key: string) => string
  renderCard: (key: string, state: CardState) => React.ReactNode
  onDrop: (activeKey: string, drop: Drop, columnId: string) => void
  /** Show where a card will land inside a column (only meaningful when order is yours to set). */
  showInsertion?: boolean
  className?: string
}

/** Other cards stay put while one is dragged: a line shows where it will land, which reads the same across columns. */
const stayPut = () => null

/**
 * A set of columns of cards that can be dragged between and within columns, with the mouse or the keyboard
 * (Space picks a card up, arrows move it, Space drops it, Escape cancels). It only reports where a card was
 * dropped; the caller decides what that means. Used by both now/next/later and the board.
 */
export function DragBoard({
  columns,
  describe,
  renderCard,
  onDrop,
  showInsertion = true,
  className,
}: Props) {
  const columnIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns])

  /**
   * Left and right step between columns (landing on the card nearest the same height, or the top of an empty
   * column); up and down move within a column. dnd-kit's own keyboard movement only handles a single list.
   */
  const coordinateGetter: KeyboardCoordinateGetter = (event, args) => {
    const { context } = args
    if (
      (event.code === 'ArrowLeft' || event.code === 'ArrowRight') &&
      context.active &&
      context.collisionRect
    ) {
      event.preventDefault()
      const rect = context.collisionRect
      const centre = rect.left + rect.width / 2
      const rects = columns.flatMap((c) => {
        const r = context.droppableRects.get(c.id)
        return r ? [{ column: c, rect: r }] : []
      })
      rects.sort((a, b) => a.rect.left - b.rect.left)
      const current = rects.findIndex((x) => centre >= x.rect.left && centre <= x.rect.right)
      const target = rects[(current === -1 ? 0 : current) + (event.code === 'ArrowRight' ? 1 : -1)]
      if (!target) return undefined
      const cards = target.column.keys.flatMap((k) => {
        const r = context.droppableRects.get(k)
        return r ? [r] : []
      })
      const nearest = cards.sort(
        (a, b) => Math.abs(a.top - rect.top) - Math.abs(b.top - rect.top),
      )[0]
      return nearest
        ? { x: nearest.left, y: nearest.top }
        : { x: target.rect.left + 12, y: target.rect.top + 12 }
    }
    return sortableKeyboardCoordinates(event, args)
  }

  /** Over a card if the pointer is on one, else over the column it is in; the keyboard falls back to nearest corners. */
  const collisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args)
    if (within.length > 0) {
      const cards = within.filter((c) => !columnIds.has(String(c.id)))
      return cards.length > 0 ? cards : within
    }
    return closestCorners(args)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )
  const [activeKey, setActiveKey] = useState<string>()
  const [overId, setOverId] = useState<string>()

  const containers = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, c.keys])),
    [columns],
  )
  const labelOf = useMemo(() => new Map(columns.map((c) => [c.id, c.label])), [columns])
  const columnOfKey = (key: string) => columns.find((c) => c.keys.includes(key))
  const drop = activeKey ? resolveDrop(containers, activeKey, overId) : undefined

  const where = (id: unknown) => {
    const over = String(id)
    return labelOf.get(over) ?? labelOf.get(columnOfKey(over)?.id ?? '') ?? ''
  }

  const reset = () => {
    setActiveKey(undefined)
    setOverId(undefined)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(e: DragStartEvent) => setActiveKey(String(e.active.id))}
      onDragOver={(e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : undefined)}
      onDragCancel={reset}
      onDragEnd={(e: DragEndEvent) => {
        const result = resolveDrop(
          containers,
          String(e.active.id),
          e.over ? String(e.over.id) : undefined,
        )
        reset()
        if (result) onDrop(String(e.active.id), result, result.containerId)
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To move this card, press Space. Use the arrow keys to choose a column or position, then press Space to drop it, or Escape to cancel. Press Enter to open its details.',
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${describe(String(active.id))}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${describe(String(active.id))} is over ${where(over.id)}.`
              : `${describe(String(active.id))} is not over a column.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `Dropped ${describe(String(active.id))} in ${where(over.id)}.`
              : `${describe(String(active.id))} was put back.`,
          onDragCancel: ({ active }) =>
            `Move cancelled. ${describe(String(active.id))} was put back.`,
        },
      }}
    >
      <div className={cn('grid gap-4', className)}>
        {columns.map((column) => (
          <Column key={column.id} column={column} active={drop?.containerId === column.id}>
            {column.keys.map((key) => (
              <li key={key} className="relative">
                {showInsertion && drop?.anchorKey === key && drop.place === 'before' && (
                  <Insertion position="top" />
                )}
                <SortableCard id={key}>
                  {(handle) => renderCard(key, { overlay: false, handleProps: handle })}
                </SortableCard>
                {showInsertion && drop?.anchorKey === key && drop.place === 'after' && (
                  <Insertion position="bottom" />
                )}
              </li>
            ))}
            {showInsertion &&
              drop?.containerId === column.id &&
              !drop.anchorKey &&
              column.keys.filter((k) => k !== activeKey).length === 0 && (
                <Insertion position="top" />
              )}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeKey ? (
          <div className="rotate-1 cursor-grabbing opacity-95 shadow-menu">
            {renderCard(activeKey, { overlay: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  column,
  active,
  children,
}: {
  column: BoardColumnSpec
  active: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: column.id })
  const empty = column.keys.length === 0
  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label}, ${column.keys.length} ${column.keys.length === 1 ? 'item' : 'items'}`}
      className={cn(
        'flex min-h-40 flex-col rounded-card p-3 transition-colors',
        active
          ? 'bg-primary-soft outline-2 -outline-offset-2 outline-primary-text/50 outline-dashed'
          : 'bg-surface',
      )}
    >
      {column.header ?? (
        <div className="flex items-baseline justify-between px-1 pb-2">
          <h3 className="text-body font-semibold text-foreground">{column.label}</h3>
          <span className="text-caption text-muted-foreground tabular-nums">
            {column.keys.length}
          </span>
        </div>
      )}
      <SortableContext items={column.keys} strategy={stayPut}>
        <ul className="flex flex-1 flex-col gap-2">
          {children}
          {empty && !active && (
            <li className="flex flex-1 items-center justify-center rounded-input border border-dashed border-border-strong px-3 py-6 text-center text-caption text-muted-foreground">
              {column.emptyText ?? 'Nothing here. Drop a card to add it.'}
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  )
}

/** The line that shows where a dragged card will land. */
function Insertion({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 z-10 flex items-center',
        position === 'top' ? '-top-1.5' : '-bottom-1.5',
      )}
    >
      <span className="size-2 rounded-full bg-primary-text" />
      <span className="h-0.5 flex-1 rounded-full bg-primary-text" />
    </div>
  )
}

interface HandleProps {
  /** Spread on the part of the card that picks it up. */
  handleProps: React.HTMLAttributes<HTMLElement> & { ref: (node: HTMLElement | null) => void }
  dragging: boolean
}

function SortableCard({
  id,
  children,
}: {
  id: string
  children: (h: HandleProps) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-35')}>
      {children({
        dragging: isDragging,
        handleProps: {
          ...attributes,
          ...listeners,
          ref: setActivatorNodeRef,
        } as HandleProps['handleProps'],
      })}
    </div>
  )
}
