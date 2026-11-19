import type * as React from 'react'
import { cn } from '@/lib/utils'

/** 20px radius, hairline, paper ground, flat at rest. Not for lists of comparable records. */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-card border bg-card p-5 text-ink sm:p-5', className)} {...props} />
  )
}
export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />
}
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-title font-semibold text-foreground', className)} {...props} />
}
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-body text-muted-foreground', className)} {...props} />
}
export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        '-mx-5 mt-5 -mb-5 flex items-center gap-2 rounded-b-card border-t bg-surface px-5 py-3',
        className,
      )}
      {...props}
    />
  )
}
