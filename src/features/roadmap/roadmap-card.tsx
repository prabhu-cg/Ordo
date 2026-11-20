import { useRef } from 'react'
import { splitHandle } from './card-handle'
import { MoreHorizontal } from 'lucide-react'
import {
  ConfidenceBadge,
  DependencyBadge,
  LevelBadge,
  PriorityBadge,
  StatusBadge,
} from '@/components/domain/indicators'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LANES,
  PRIORITIES,
  WORK_STATUSES,
  type Feature,
  type Lane,
  type Priority,
  type WorkStatus,
  type Tone,
} from '@/domain'
import { formatDate } from '@/lib/format'
import { TONE_EDGE } from '@/lib/appearance'
import { LANE_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { RoadmapRow } from './engine'

import type { CardField } from './card-fields'

export interface QuickHandlers {
  onStatus: (status: WorkStatus) => void
  onPriority: (priority: Priority | undefined) => void
  onLane?: (lane: Lane) => void
  onRemove: () => void
  onOpen: () => void
}

interface CardProps {
  row: RoadmapRow
  fields: ReadonlySet<CardField>
  /** The initiative a feature belongs to. */
  parentTitle?: string
  objectiveTitle?: string
  tagNames?: string[]
  hideStatus?: boolean
  /** What this item is linked to, for the dependency badge. */
  links?: Parameters<typeof DependencyBadge>[0]['links']
  lane?: Lane
  quick?: QuickHandlers
  /** Spread on the area that picks the card up. */
  handleProps?: React.HTMLAttributes<HTMLElement> & { ref?: (node: HTMLElement | null) => void }
  onOpen?: () => void
  overlay?: boolean
  /** The roadmap's colour, drawn as an edge on the card. */
  accent?: Tone
}

/**
 * One card for one roadmap row, used by now/next/later and the board. The same record draws the same way in
 * both; only which details it shows can differ.
 */
export function RoadmapCard({
  row,
  fields,
  parentTitle,
  objectiveTitle,
  tagNames,
  hideStatus,
  links,
  accent,
  lane,
  quick,
  handleProps,
  onOpen,
  overlay,
}: CardProps) {
  const item = row.item
  const feature = row.kind === 'feature' ? (item as Feature) : undefined
  const dates =
    item.startDate && item.endDate
      ? `${formatDate(item.startDate)} to ${formatDate(item.endDate)}`
      : item.startDate
        ? `From ${formatDate(item.startDate)}`
        : item.endDate
          ? `Until ${formatDate(item.endDate)}`
          : undefined

  const meta: string[] = []
  if (feature && parentTitle) meta.push(parentTitle)
  if (fields.has('objective') && objectiveTitle) meta.push(objectiveTitle)
  if (fields.has('owner') && item.owner) meta.push(item.owner)

  // The drag library gives one bundle for "the thing you grab". Its event listeners go on the whole card, so you can
  // grab it anywhere; its role, focus and labelling go on the title alone, so the one focusable element is named
  // by exactly the text it shows. The other details are ordinary text beside it, which a screen reader reads too.
  const {
    ref: handleRef,
    listeners,
    attributes,
  } = splitHandle(handleProps as Record<string, unknown> | undefined)
  const titleRef = useRef<HTMLElement | null>(null)

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    handleProps?.onKeyDown?.(e)
    if (e.key === 'Enter' && e.target === titleRef.current) {
      // Without this the browser's follow-up keypress lands on whatever the drawer focused (its Close button) and shuts it again.
      e.preventDefault()
      onOpen?.()
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-input border bg-card transition-colors',
        accent && cn('border-l-4', TONE_EDGE[accent]),
        !overlay && 'hover:border-border-strong',
      )}
    >
      <div
        {...listeners}
        onKeyDown={onKeyDown}
        onClick={onOpen}
        className={cn(
          'block cursor-pointer rounded-input p-[var(--card-pad)] pr-10 text-left has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40',
          overlay && 'cursor-grabbing',
        )}
      >
        <span className="flex items-center gap-1.5 text-label text-muted-foreground">
          {feature ? 'Feature' : 'Initiative'}
          {lane && <span aria-hidden>·</span>}
          {lane && <span>{LANE_LABELS[lane]}</span>}
        </span>
        <span
          {...(overlay ? {} : { role: 'button', tabIndex: 0, ...attributes })}
          ref={(node) => {
            titleRef.current = node
            if (!overlay) handleRef?.(node)
          }}
          aria-label={overlay ? undefined : `${item.title}, ${row.kind}`}
          className="mt-1 line-clamp-3 block text-body font-semibold break-words text-foreground outline-none"
        >
          {item.title}
        </span>
        <span className="mt-[var(--card-gap)] flex flex-wrap items-center gap-1.5">
          {!hideStatus && <StatusBadge status={item.status} />}
          {fields.has('priority') && item.priority && <PriorityBadge priority={item.priority} />}
          {fields.has('confidence') && item.confidence && (
            <ConfidenceBadge confidence={item.confidence} focusable={false} />
          )}
          {fields.has('impact') && item.scoring?.impact && (
            <LevelBadge kind="Impact" level={item.scoring.impact} />
          )}
          {fields.has('effort') && item.scoring?.effort && (
            <LevelBadge kind="Effort" level={item.scoring.effort} />
          )}
          {fields.has('dependencies') && <DependencyBadge links={links} focusable={false} />}
        </span>
        {meta.length > 0 && (
          <span className="mt-2 block truncate text-caption text-muted-foreground">
            {meta.join(' · ')}
          </span>
        )}
        {fields.has('dates') && (
          <span className="mt-1 block text-caption text-muted-foreground tabular-nums">
            {dates ?? 'No dates'}
          </span>
        )}
        {fields.has('tags') && tagNames && tagNames.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1">
            {tagNames.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </span>
        )}
      </div>
      {quick && !overlay && <QuickEdit row={row} lane={lane} quick={quick} />}
    </div>
  )
}

/**
 * Change status, priority or lane, or remove the card, without opening it. This is also the way to do
 * everything dragging does, from the keyboard.
 */
function QuickEdit({ row, lane, quick }: { row: RoadmapRow; lane?: Lane; quick: QuickHandlers }) {
  return (
    <div className="absolute top-1.5 right-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-label={`Quick edit ${row.item.title}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[min(30rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto"
        >
          <DropdownMenuItem onSelect={quick.onOpen}>Open details</DropdownMenuItem>
          {quick.onLane && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={lane ?? ''}
                onValueChange={(v) => quick.onLane?.(v as Lane)}
              >
                {LANES.map((l) => (
                  <DropdownMenuRadioItem key={l} value={l}>
                    {LANE_LABELS[l]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={row.item.status}
            onValueChange={(v) => quick.onStatus(v as WorkStatus)}
          >
            {WORK_STATUSES.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={row.item.priority ?? 'none'}
            onValueChange={(v) => quick.onPriority(v === 'none' ? undefined : (v as Priority))}
          >
            {PRIORITIES.map((p) => (
              <DropdownMenuRadioItem key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </DropdownMenuRadioItem>
            ))}
            <DropdownMenuRadioItem value="none">Not set</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={quick.onRemove}>Remove from roadmap</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
