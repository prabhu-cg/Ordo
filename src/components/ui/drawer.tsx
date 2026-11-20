import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import type * as React from 'react'
import { useRestoreFocus } from '@/lib/use-restore-focus'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { DialogOverlay } from './dialog'

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

const drawerVariants = cva(
  'fixed inset-y-0 z-50 flex w-full flex-col bg-card text-ink shadow-drawer outline-none',
  {
    variants: {
      side: {
        right:
          'right-0 rounded-l-card border-l data-[state=closed]:animate-drawer-out data-[state=open]:animate-drawer-in',
        left: 'left-0 rounded-r-card border-r data-[state=closed]:animate-drawer-left-out data-[state=open]:animate-drawer-left-in',
      },
      size: {
        default: 'sm:max-w-md', // 448px
        lg: 'sm:max-w-xl', // 576px
        xl: 'sm:max-w-3xl', // 768px
        nav: 'max-w-[18rem]',
      },
    },
    defaultVariants: { side: 'right', size: 'default' },
  },
)

/** Create, edit and settings surfaces open as a right-hand drawer: chrome on desk, content on paper. */
export function DrawerContent({
  className,
  children,
  side,
  size,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & VariantProps<typeof drawerVariants>) {
  // Focus the panel itself, unless a field inside already asked for focus. Otherwise focus would land on
  // whatever is first, such as a badge with a tooltip, and the tooltip would swallow the first Escape.
  const focus = useRestoreFocus((e) => {
    const panel = (e.currentTarget ?? e.target) as HTMLElement | null
    const content = panel?.closest?.('[role="dialog"]') ?? panel
    if (content instanceof HTMLElement && !content.contains(document.activeElement)) {
      e.preventDefault()
      content.focus()
    }
  })
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...focus}
        className={cn(drawerVariants({ side, size }), className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DrawerHeader({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b bg-surface px-6 py-5 sm:px-8 sm:py-6',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
      <DialogPrimitive.Close asChild>
        <Button variant="outline" size="icon-sm" aria-label="Close">
          <X aria-hidden />
        </Button>
      </DialogPrimitive.Close>
    </div>
  )
}
export function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-2xl leading-tight', className)} {...props} />
}
export function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-body text-muted-foreground', className)}
      {...props}
    />
  )
}
export function DrawerBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8', className)} {...props} />
  )
}
export function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t bg-surface px-6 py-4 sm:px-8',
        className,
      )}
      {...props}
    />
  )
}
