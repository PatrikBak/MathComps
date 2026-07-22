import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'

import { cn } from '../utils/css-utils'

/** Root component that manages open/close state of the popover. */
const Popover = PopoverPrimitive.Root

/** Button (or custom element via `asChild`) that toggles the popover. */
const PopoverTrigger = PopoverPrimitive.Trigger

/**
 * Positioned content panel rendered inside a portal.
 * Provides the dark-slate theme chrome, border, shadow, and slide-in animations.
 */
const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] rounded-md border border-foreground/10 bg-surface p-1 text-foreground shadow-md',
        'animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

/**
 * A selectable row inside the popover — a plain button styled like a menu item.
 * Without a menu's roving focus, it highlights on hover rather than on focus.
 */
const PopoverItem = React.forwardRef<
  React.ComponentRef<'button'>,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors',
      'hover:bg-foreground/5 hover:text-foreground focus-visible:bg-foreground/5 focus-visible:text-foreground',
      'disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
))
PopoverItem.displayName = 'PopoverItem'

/** Horizontal divider between groups of popover items. */
const PopoverSeparator = React.forwardRef<
  React.ComponentRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('-mx-1 my-1 h-px bg-foreground/10', className)} {...props} />
))
PopoverSeparator.displayName = 'PopoverSeparator'

export { Popover, PopoverContent, PopoverItem, PopoverSeparator, PopoverTrigger }
