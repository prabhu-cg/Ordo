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
   * Arrow keys move a picked-up card through whatever layout the columns are in, including a grid of rows:
   * left and right go to the column beside, up and down go to the next card in the column or, at its end, to the
   * column above or below. dnd-kit's own keyboard movement only understands a single list.
   */
  const coordinateGetter: KeyboardCoordinateGetter = (event, args) => {
    const { context } = args
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.code as string
    ]
    if (!dir || !context.active || !context.collisionRect)
      return sortableKeyboardCoordinates(event, args)
    event.preventDefault()
    const rect = context.collisionRect
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const cols = columns.flatMap((c) => {
      const r = context.droppableRects.get(c.id)
      return r ? [{ column: c, rect: r, x: r.left + r.width / 2, y: r.top + r.height / 2 }] : []
    })
    if (cols.length === 0) return undefined
    const current =
      cols.find(
        (c) => cx >= c.rect.left && cx <= c.rect.right && cy >= c.rect.top && cy <= c.rect.bottom,
      ) ?? cols[0]!
    const cardRects = (c: (typeof cols)[number]) =>
      c.column.keys.flatMap((k) => {
        const r = context.droppableRects.get(k)
        return r ? [r] : []
      })
    const land = (c: (typeof cols)[number], from: 'nearest' | 'first' | 'last') => {
      const cards = cardRects(c).sort((a, b) => a.top - b.top)
      const card =
        from === 'first'
          ? cards[0]
          : from === 'last'
            ? cards[cards.length - 1]
            : [...cards].sort((a, b) => Math.abs(a.top - rect.top) - Math.abs(b.top - rect.top))[0]
      return card ? { x: card.left, y: card.top } : { x: c.rect.left + 12, y: c.rect.top + 12 }
    }

    if (dir[0] !== 0) {
      const beside = cols.filter(
        (c) =>
          c !== current &&
          (dir[0]! > 0
            ? c.rect.left >= current.rect.right - 1
            : c.rect.right <= current.rect.left + 1),
      )
      beside.sort(
        (a, b) =>
          Math.abs(a.y - current.y) - Math.abs(b.y - current.y) ||
          Math.abs(a.x - current.x) - Math.abs(b.x - current.x),
      )
      return beside[0] ? land(beside[0], 'nearest') : undefined
    }
    // Up and down: another card in this column first.
    const sameColumn = cardRects(current).sort((a, b) => a.top - b.top)
    const next =
      dir[1]! > 0
        ? sameColumn.find((r) => r.top > rect.top + 1)
        : [...sameColumn].reverse().find((r) => r.top < rect.top - 1)
    if (next) return { x: next.left, y: next.top }
    const beyond = cols.filter(
      (c) =>
        c !== current &&
        (dir[1]! > 0
          ? c.rect.top >= current.rect.bottom - 1
          : c.rect.bottom <= current.rect.top + 1),
    )
    beyond.sort(
      (a, b) =>
        Math.abs(a.x - current.x) - Math.abs(b.x - current.x) ||
        Math.abs(a.y - current.y) - Math.abs(b.y - current.y),
    )
    return beyond[0] ? land(beyond[0], dir[1]! > 0 ? 'first' : 'last') : undefined
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
