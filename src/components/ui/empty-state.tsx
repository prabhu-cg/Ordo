import type * as React from 'react'
import { cn } from '@/lib/utils'

/** A dashed hairline panel: one statement, at most one line of copy, then the single next action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-border-strong px-6 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <div
          className="mb-4 flex size-10 items-center justify-center rounded-input bg-primary-soft text-primary-text [&_svg]:size-5"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <p className="text-body font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-body text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
