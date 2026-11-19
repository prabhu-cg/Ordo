import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Every button is a pill. One filled `primary` per view; a repeated action is `outline`.
 * Destructive actions are outline with red text, never a solid red block.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        outline: 'border border-border-strong bg-background text-foreground hover:bg-sand',
        secondary: 'bg-secondary text-foreground hover:bg-border',
        ghost: 'text-ink hover:bg-sand hover:text-foreground',
        destructive:
          'border border-border-strong bg-background text-destructive hover:bg-destructive-soft',
        link: 'rounded-sm text-primary-text underline underline-offset-4 hover:text-foreground',
      },
      size: {
        xs: 'h-7 px-3 text-label',
        sm: 'h-9 px-3.5 text-body',
        default: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-[1rem]',
        icon: 'size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Shows a spinner and blocks repeat clicks while an action is in flight. */
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)
  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    )
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}
