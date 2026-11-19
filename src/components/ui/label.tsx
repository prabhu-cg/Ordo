import * as LabelPrimitive from '@radix-ui/react-label'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-body leading-none font-medium text-foreground select-none peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
