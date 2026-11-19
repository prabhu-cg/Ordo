import type * as React from 'react'
import { cn } from '@/lib/utils'

/** One h1 per page: the 28px display serif, an optional description, actions to the right. */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
}: {
  title: string
  description?: string
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="max-w-prose min-w-0">
        <h1 className="text-headline leading-tight [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-2 text-title text-ink">{description}</p>}
        {meta && <p className="mt-3 text-caption text-muted-foreground">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  )
}
