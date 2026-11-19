import * as React from 'react'
import { cn } from '@/lib/utils'

/** Shared look for text fields, textareas and selects: 8px radius, 3:1 outline, ochre focus. */
export const fieldClasses =
  'w-full rounded-input border border-input bg-card text-ink placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus-visible:border-primary-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-sand'

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(fieldClasses, 'h-10 px-3 text-[1rem] md:text-body', className)}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        fieldClasses,
        'min-h-24 resize-y px-3 py-2 text-[1rem] md:text-body',
        className,
      )}
      {...props}
    />
  )
}

/** Native select, styled. Native keeps keyboard, mobile pickers and screen readers correct. */
export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(fieldClasses, 'h-10 pl-3 text-[1rem] md:text-body', className)}
      {...props}
    >
      {children}
    </select>
  )
}
