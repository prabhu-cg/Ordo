import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex gap-3 rounded-input px-4 py-3 text-body', {
  variants: {
    tone: {
      info: 'bg-info-soft text-info',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      destructive: 'bg-destructive-soft text-destructive',
    },
  },
  defaultVariants: { tone: 'info' },
})
const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, destructive: XCircle }

/** An inline message that stays in the page: confirmations, warnings and recoverable errors. */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
  action,
}: VariantProps<typeof alertVariants> & {
  title: string
  children?: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  const Icon = icons[tone ?? 'info']
  return (
    <div
      role={tone === 'destructive' || tone === 'warning' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-ink">{children}</div>}
      </div>
      {action}
    </div>
  )
}
