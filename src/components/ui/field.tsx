import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  label: string
  /** Sits beside the label but outside it, so it does not become part of the control's accessible name. */
  labelAddon?: React.ReactNode
  /** Rendered after the label, e.g. "optional". */
  note?: string
  hint?: string
  error?: string
  className?: string
  /** Receives the id and aria props to put on the control. */
  children: (control: {
    id: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }) => React.ReactNode
}

/** Label + control + hint + error, wired together for assistive tech. */
export function Field({ label, labelAddon, note, hint, error, className, children }: FieldProps) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>
          {label}
          {note && <span className="ml-1.5 font-normal text-muted-foreground">{note}</span>}
        </Label>
        {labelAddon}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-caption font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
