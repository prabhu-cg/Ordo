import * as TabsPrimitive from '@radix-ui/react-tabs'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List className={cn('inline-flex items-center gap-1', className)} {...props} />
  )
}

/** Selection is butter, not grey: the current tab is `primary-soft` with ochre text. */
export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-full px-3.5 text-body font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-sand hover:text-foreground disabled:opacity-50 data-[state=active]:bg-primary-soft data-[state=active]:font-semibold data-[state=active]:text-primary-text',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 focus-visible:outline-offset-4', className)}
      {...props}
    />
  )
}
