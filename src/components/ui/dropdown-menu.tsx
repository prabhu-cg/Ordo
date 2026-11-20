import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Menus are not modal. A modal menu hides the rest of the page from assistive technology while it is open, yet
 * leaves everything behind it focusable, which is itself an accessibility fault. A non-modal one closes on Escape or
 * a click elsewhere just the same, and keeps the page honest about what can be reached.
 */
export function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root modal={false} {...props} />
}
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'start',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-[60] min-w-56 animate-menu-in rounded-menu border border-border-strong bg-popover p-1.5 text-ink shadow-menu',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

const itemBase =
  'relative flex cursor-default items-center gap-2.5 rounded-full px-3 py-2 text-body font-medium outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-sand data-[highlighted]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        itemBase,
        destructive &&
          'text-destructive data-[highlighted]:bg-destructive-soft data-[highlighted]:text-destructive [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  )
}

/** A choice where one item is current (e.g. the active product). */
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        itemBase,
        'justify-between data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary-text',
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="!text-primary-text" aria-hidden />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  )
}
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/** A setting that is on or off and stays open while you toggle it (for example, which details a card shows). */
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(itemBase, 'justify-between data-[state=checked]:text-foreground', className)}
      {...props}
    >
      <span className="truncate">{children}</span>
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="!text-primary-text" aria-hidden />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-3 py-1.5 text-label font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1.5 my-1.5 h-px bg-border', className)}
      {...props}
    />
  )
}
