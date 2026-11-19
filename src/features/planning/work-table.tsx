import { Badge } from '@/components/ui/badge'
import type { Tag, WorkStatus } from '@/domain'
import { STATUS_BADGE, STATUS_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'

/** Shared building blocks for the initiatives and features tables. */
export const th = 'border-b px-3 py-2.5 text-label font-semibold text-muted-foreground'
export const td = 'border-b px-3 py-3 align-top'

export const StatusBadge = ({ status }: { status: WorkStatus }) => (
  <Badge variant={STATUS_BADGE[status]}>{STATUS_LABELS[status]}</Badge>
)

export function TagList({
  ids,
  tags,
  className,
}: {
  ids: string[]
  tags: Tag[]
  className?: string
}) {
  const named = ids.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => Boolean(t))
  if (named.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <ul className={cn('flex flex-wrap gap-1', className)} aria-label="Tags">
      {named.map((t) => (
        <li key={t.id}>
          <Badge variant="outline">{t.name}</Badge>
        </li>
      ))}
    </ul>
  )
}

/** Wraps a table so it can scroll sideways on a phone without moving the page. */
export function TableFrame({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">{children}</div>
}
