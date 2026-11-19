import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/** 20px pills. Status colour comes from semantic tokens, never raw hex. */
const badgeVariants = cva(
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-transparent px-2 text-label font-semibold whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        soft: 'bg-primary-soft text-primary-text',
        outline: 'border-border-strong bg-background text-foreground',
        secondary: 'bg-secondary text-ink',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        info: 'bg-info-soft text-info',
        destructive: 'bg-destructive-soft text-destructive',
      },
    },
    defaultVariants: { variant: 'soft' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
