import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Compass,
  Equal,
  Gauge,
  HelpCircle,
  Link2,
  Lock,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import {
  CONFIDENCE_LEVELS,
  type Confidence,
  type Level,
  type Priority,
  type WorkStatus,
} from '@/domain'
import { TONE_BADGE } from '@/lib/appearance'
import { useAppearanceStore } from '@/store/appearance-store'
import {
  CONFIDENCE_BADGE,
  CONFIDENCE_HELP,
  CONFIDENCE_LABELS,
  LEVEL_LABELS,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from '@/lib/labels'
import { cn } from '@/lib/utils'

/**
 * One look for each idea, wherever it appears. Colour is never the only signal: priority carries an arrow,
 * confidence an icon, and every badge says its word.
 */
/** A status, in the colour chosen for it under Appearance. */
export function StatusBadge({ status, className }: { status: WorkStatus; className?: string }) {
  const tone = useAppearanceStore((s) => s.statusTones[status])
  return (
    <Badge variant={TONE_BADGE[tone]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

const PRIORITY_ICON = {
  critical: ChevronsUp,
  high: ChevronUp,
  medium: Equal,
  low: ChevronDown,
} as const

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: Priority
  className?: string
}) {
  if (!priority) return <span className="text-muted-foreground">—</span>
  const Icon = PRIORITY_ICON[priority]
  return (
    <Badge variant={PRIORITY_BADGE[priority]} className={className}>
      <Icon aria-hidden />
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}

const CONFIDENCE_ICON = { exploring: Compass, tentative: HelpCircle, committed: Lock } as const

/** Confidence, with its meaning in a tooltip that opens on hover and on keyboard focus. */
export function ConfidenceBadge({
  confidence,
  className,
  focusable = true,
}: {
  confidence?: Confidence
  className?: string
  focusable?: boolean
}) {
  if (!confidence) return <span className="text-muted-foreground">—</span>
  const Icon = CONFIDENCE_ICON[confidence]
  const badge = (
    <Badge variant={CONFIDENCE_BADGE[confidence]} className={className}>
      <Icon aria-hidden />
      {CONFIDENCE_LABELS[confidence]}
    </Badge>
  )
  return (
    <Tooltip content={CONFIDENCE_HELP[confidence]}>
      {/* A tooltip needs something focusable to hang on, so keyboard users get it too. */}
      <span
        tabIndex={focusable ? 0 : undefined}
        className="inline-flex rounded-full"
        aria-label={
          focusable ? `${CONFIDENCE_LABELS[confidence]}. ${CONFIDENCE_HELP[confidence]}` : undefined
        }
      >
        {badge}
      </span>
    </Tooltip>
  )
}

/** All three confidence labels and what they mean, for the form's help. */
export function ConfidenceKey({ className }: { className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-1.5', className)}>
      {CONFIDENCE_LEVELS.map((c) => (
        <div key={c} className="flex flex-col gap-0.5">
          <dt className="text-label font-semibold text-foreground">{CONFIDENCE_LABELS[c]}</dt>
          <dd className="text-caption text-muted-foreground">{CONFIDENCE_HELP[c]}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "Impact: High" or "Effort: Low". */
export function LevelBadge({
  kind,
  level,
  className,
}: {
  kind: 'Impact' | 'Effort'
  level?: Level
  className?: string
}) {
  if (!level) return <span className="text-muted-foreground">—</span>
  const Icon = kind === 'Impact' ? Zap : Gauge
  return (
    <Badge variant="outline" className={className}>
      <Icon aria-hidden />
      {kind} {LEVEL_LABELS[level].toLowerCase()}
    </Badge>
  )
}

/** Just the word, for a table cell under its own column heading. */
export const LevelText = ({ level }: { level?: Level }) =>
  level ? <span>{LEVEL_LABELS[level]}</span> : <span className="text-muted-foreground">—</span>

interface Links {
  blockedBy: { title: string; done: boolean }[]
  blocks: { title: string }[]
  related: { title: string }[]
  waiting: boolean
}

/**
 * Shows that an item is linked to others: waiting on something unfinished (warning), unblocked, blocking
 * something, or just related. The tooltip names what it is linked to.
 */
export function DependencyBadge({
  links,
  className,
  focusable = true,
}: {
  links?: Links
  className?: string
  focusable?: boolean
}) {
  if (
    !links ||
    (links.blockedBy.length === 0 && links.blocks.length === 0 && links.related.length === 0)
  )
    return null
  const lines = [
    ...links.blockedBy.map((b) => `Waiting for ${b.title}${b.done ? ' (done)' : ''}`),
    ...links.blocks.map((b) => `Blocks ${b.title}`),
    ...links.related.map((b) => `Related to ${b.title}`),
  ]
  const [variant, text] =
    links.blockedBy.length > 0
      ? links.waiting
        ? (['warning', `Blocked by ${links.blockedBy.filter((b) => !b.done).length}`] as const)
        : (['success', 'Unblocked'] as const)
      : links.blocks.length > 0
        ? (['secondary', `Blocks ${links.blocks.length}`] as const)
        : (['outline', `Related ${links.related.length}`] as const)
  return (
    <Tooltip
      content={
        <ul className="flex flex-col gap-0.5">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      }
    >
      <span
        tabIndex={focusable ? 0 : undefined}
        className="inline-flex rounded-full"
        aria-label={focusable ? `${text}. ${lines.join('. ')}` : undefined}
      >
        <Badge variant={variant} className={className}>
          <Link2 aria-hidden />
          {text}
        </Badge>
      </span>
    </Tooltip>
  )
}
