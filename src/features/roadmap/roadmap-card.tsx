import { MoreHorizontal } from 'lucide-react'
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
  lane?: Lane
  quick?: QuickHandlers
  /** Spread on the area that picks the card up. */
  handleProps?: React.HTMLAttributes<HTMLElement> & { ref?: (node: HTMLElement | null) => void }
  onOpen?: () => void
  overlay?: boolean
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
  lane,
  quick,
  handleProps,
  onOpen,
  overlay,
}: CardProps) {
  const item = row.item
  const initiative = row.kind === 'initiative' ? (item as Initiative) : undefined
  const feature = row.kind === 'feature' ? (item as Feature) : undefined
  const confidence = initiative?.scoring?.confidence
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    handleProps?.onKeyDown?.(e)
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      // Without this the browser's follow-up keypress lands on whatever the drawer focused (its Close button) and shuts it again.
      e.preventDefault()
      onOpen?.()
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-input border bg-card transition-colors',
        !overlay && 'hover:border-border-strong',
      )}
    >
      <div
        {...handleProps}
        onKeyDown={onKeyDown}
        onClick={onOpen}
        className={cn(
          'block cursor-pointer rounded-input p-3 pr-10 text-left outline-offset-2',
          overlay && 'cursor-grabbing',
        )}
        aria-label={`${item.title}, ${row.kind}`}
      >
        <span className="flex items-center gap-1.5 text-label text-muted-foreground">
          {feature ? 'Feature' : 'Initiative'}
          {lane && <span aria-hidden>·</span>}
          {lane && <span>{LANE_LABELS[lane]}</span>}
        </span>
        <span className="mt-1 line-clamp-3 block text-body font-semibold break-words text-foreground">
          {item.title}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {!hideStatus && (
            <Badge variant={STATUS_BADGE[item.status]}>{STATUS_LABELS[item.status]}</Badge>
          )}
          {fields.has('priority') && item.priority && (
            <Badge variant={PRIORITY_BADGE[item.priority]}>{PRIORITY_LABELS[item.priority]}</Badge>
          )}
          {fields.has('confidence') && confidence !== undefined && (
            <Badge
              variant="outline"
              className="tabular-nums"
              title="How sure you are this will have the expected impact"
            >
              Confidence {confidence}/5
            </Badge>
          )}
          {fields.has('impact') && item.scoring?.impact !== undefined && (
            <Badge variant="outline" className="tabular-nums">
              Impact {item.scoring.impact}/5
            </Badge>
          )}
          {fields.has('effort') && item.scoring?.effort !== undefined && (
            <Badge variant="outline" className="tabular-nums">
              Effort {item.scoring.effort}/5
            </Badge>
          )}
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
