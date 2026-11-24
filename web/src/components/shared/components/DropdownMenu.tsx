import { useUncontrolled } from '@mantine/hooks'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import * as React from 'react'

import { useTapToggle } from '@/hooks/use-tap-toggle'

import { cn } from '../utils/css-utils'
import { focusForReader, latestPointerPressTarget } from '../utils/focus-utils'

/**
 * What an anchored panel opens over: the page itself, or a card laid on it.
 */
export type FloatingPanelSurface = 'page' | 'card'

/**
 * The fill a panel takes over each surface, set as `--floating-panel-fill` so that chrome inside the panel
 * can share it. Over the page the panel stands a step above it; over a card it takes the card's own colour.
 */
export const FLOATING_PANEL_FILLS: Record<FloatingPanelSurface, string> = {
  page: '[--floating-panel-fill:var(--color-surface-raised)]',
  card: '[--floating-panel-fill:var(--color-surface)]',
}

/**
 * A background in the surrounding panel's fill, worn by the panel itself and by any chrome inside it.
 * Opaque, so nothing under the panel shows through its rows, and no row shows through the chrome it
 * scrolls under.
 */
export const FLOATING_PANEL_FILL_CLASS = 'bg-[var(--floating-panel-fill)]'

/**
 * What a panel anchored to a trigger is made of: a slab on the ladder's floating rung, so it clears the
 * dialog it may have been opened from. Its colour comes from whichever of {@link FLOATING_PANEL_FILLS} is
 * set beside it.
 */
export const FLOATING_PANEL_CLASS = cn(
  'z-floating rounded-lg border border-foreground/10 text-foreground shadow-lg',
  FLOATING_PANEL_FILL_CLASS
)

/**
 * What an anchored content panel takes on top of its Radix props.
 */
export type FloatingPanelContentProps = {
  /** What the panel opens over, which picks its fill. */
  opensOver?: FloatingPanelSurface
}

/**
 * How an anchored panel arrives and leaves: fading and growing out of the edge it hangs from, and
 * back the same way.
 *
 * Keyed off the `data-state` and `data-side` attributes Radix writes, so it fits any of its panels.
 */
export const FLOATING_PANEL_MOTION_CLASS = cn(
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
  'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2'
)

/** The room a panel keeps clear between itself and the window's edges, in pixels. */
export const WINDOW_EDGE_CLEARANCE_PX = 8

/** A function which opens a menu when it is shut and shuts it when it is open; null outside a menu. */
const MenuToggleContext = React.createContext<(() => void) | null>(null)

/**
 * Root component that manages open/close state of the dropdown. It holds that state itself when the caller leaves
 * it uncontrolled, so that its trigger can toggle the menu on a tap.
 */
export function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: DropdownMenuPrimitive.DropdownMenuProps) {
  // Whether the menu is open, held by the caller when it passes the state in
  const [isOpen, setIsOpen] = useUncontrolled({
    value: open,
    defaultValue: defaultOpen,
    finalValue: false,
    onChange: onOpenChange,
  })

  // A function which opens the menu when it is shut and shuts it when it is open
  const toggle = () => setIsOpen(!isOpen)

  // The menu, its toggle within reach of its trigger
  return (
    <MenuToggleContext value={toggle}>
      <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={setIsOpen} {...props} />
    </MenuToggleContext>
  )
}

/**
 * Reads the toggle of the menu around the caller. Throws outside a {@link DropdownMenu}.
 *
 * @returns A function which opens the menu when it is shut and shuts it when it is open.
 */
function useMenuToggle(): () => void {
  // The toggle of the nearest menu
  const toggle = React.use(MenuToggleContext)

  // Read outside a menu, which is a bug in the tree
  if (toggle === null) throw new Error('useMenuToggle outside DropdownMenu')

  // The menu's toggle
  return toggle
}

/**
 * Button (or custom element via `asChild`) that toggles the dropdown. A mouse opens the menu on press, and a finger
 * or a pen on the tap, so that a scroll can start on the button.
 */
export const DropdownMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ onPointerDown, onPointerUp, ...props }, ref) => {
  // The toggle of the menu around the trigger
  const toggle = useMenuToggle()

  // The press handlers moving a finger's toggle from the press to the tap
  const tap = useTapToggle(toggle)

  // The trigger, a press the caller turns away opening nothing
  return (
    <DropdownMenuPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        // The caller's own handler first
        onPointerDown?.(event)

        // Then the tap's, unless the trigger is off. Radix's own open on press skips the press it cancels
        if (!props.disabled) tap.onPointerDown(event)
      }}
      onPointerUp={(event) => {
        // The caller's own handler first
        onPointerUp?.(event)

        // Then the tap's
        tap.onPointerUp(event)
      }}
      {...props}
    />
  )
})
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName

/** Rows that belong together, named as one by the label its `aria-labelledby` points at. */
export const DropdownMenuGroup = DropdownMenuPrimitive.Group

/**
 * Positioned content panel rendered inside a portal.
 * Provides the house panel chrome, its motion, and the padding its rows sit in. A panel taller than the room the
 * window leaves for it scrolls inside itself.
 *
 * A pointer closing it hands focus back to the trigger unringed. Radix's own hand-back is a bare
 * `focus()`, which the browser rings unless the last focus it saw came from the mouse, and the click
 * that opened the menu never counts as one, because the trigger cancels its `pointerdown`.
 *
 * A press out on the page closing a non-modal menu leaves focus where it landed, as Radix does. A modal
 * menu switches the page's pointer events off while it is open, so a press outside one lands on the root
 * element instead, and its trigger gets focus back unringed like after any other pointer close.
 */
export const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & FloatingPanelContentProps
>(({ className, sideOffset = 4, opensOver = 'page', onCloseAutoFocus, ...props }, ref) => {
  // A function which focuses the trigger without a ring once a pointer has closed the menu
  const handleCloseAutoFocus = (event: Event) => {
    // The close handler passed in runs first, and may claim the hand-back
    onCloseAutoFocus?.(event)

    // The element the closing press landed on, absent when a key closed the menu
    const pressTarget = latestPointerPressTarget()

    // A claimed hand-back, or a menu closed from the keyboard, is left to Radix
    if (event.defaultPrevented || !(pressTarget instanceof Node)) return

    // The closed panel
    const panel = event.target as Element

    // The trigger the closed panel is labelled by
    const trigger = document.getElementById(panel.getAttribute('aria-labelledby') ?? '')

    // A focus already held elsewhere, or a trigger nowhere to be found, is left to Radix too
    if (trigger === null || document.activeElement !== document.body) return

    // Whether the press landed on the page, which a press outside a modal menu never does
    const isPressOnPage = document.body.contains(pressTarget)

    // A press out on the page, away from both the panel and its trigger, is left to Radix as well
    if (isPressOnPage && !panel.contains(pressTarget) && !trigger.contains(pressTarget)) return

    // Claim the hand-back from Radix
    event.preventDefault()

    // Hand the focus back, the pointer's press leaving it unringed, and without scrolling to a trigger the page has
    // left behind
    focusForReader(trigger, { preventScroll: true })
  }

  // The panel, portalled to the end of the page
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          FLOATING_PANEL_CLASS,
          FLOATING_PANEL_FILLS[opensOver],
          FLOATING_PANEL_MOTION_CLASS,
          'min-w-[8rem] p-1',
          // No taller than the room the window leaves on its side of the trigger, scrolling the rest, since a panel
          // pinned to the window and running past its edge can never be scrolled to
          'max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overscroll-contain',
          className
        )}
        // Kept clear of the window's edges
        collisionPadding={WINDOW_EDGE_CLEARANCE_PX}
        onCloseAutoFocus={handleCloseAutoFocus}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

/** What a row does to what it acts on: an ordinary action, or one that destroys something. */
type DropdownMenuItemVariant = 'default' | 'danger'

/** The ink of each {@link DropdownMenuItemVariant}, held under the focus highlight. */
const ITEM_VARIANT_CLASS: Record<DropdownMenuItemVariant, string> = {
  default: 'focus:text-foreground',
  danger: 'text-error focus:text-error',
}

/**
 * What a row takes on top of its Radix props.
 */
type DropdownMenuItemProps = {
  /** What the row does to what it acts on. */
  variant?: DropdownMenuItemVariant
}

/**
 * A single selectable row inside the dropdown.
 * Includes focus highlight, disabled styling, and pointer cursor by default.
 */
export const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & DropdownMenuItemProps
>(({ className, variant = 'default', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-foreground/5 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      ITEM_VARIANT_CLASS[variant],
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

/**
 * A toggleable row inside the dropdown — renders a check mark when `checked` is true.
 * Carries proper `role="menuitemcheckbox"` + `aria-checked` semantics via Radix.
 */
export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-foreground/5 focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

/**
 * The props of {@link DropdownMenuItemIcon}.
 */
type DropdownMenuItemIconProps = {
  /** The row's icon. */
  children: React.ReactNode
}

/**
 * The slot a row's icon sits in at the row's start, one width for every row, so the rows' text lines up whether the
 * slot holds an icon or stands empty.
 */
export function DropdownMenuItemIcon({ children }: DropdownMenuItemIconProps) {
  return <span className="mr-2 flex w-5 shrink-0 items-center justify-center">{children}</span>
}

/**
 * A group of rows of which exactly one is picked, such as how something is sorted or drawn.
 */
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/**
 * One row of a {@link DropdownMenuRadioGroup}, checked and read in the brand's violet while it is the one picked. The
 * check stands in the {@link DropdownMenuItemIcon} slot.
 */
export const DropdownMenuRadioItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
      'focus:bg-foreground/5 data-[state=checked]:text-brand-light',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <DropdownMenuItemIcon>
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuItemIcon>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

/**
 * A heading over a group of rows, naming the group.
 */
export const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 pb-1 pt-1.5 text-xs font-medium text-muted', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

/** Horizontal divider between groups of menu items. */
export const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-foreground/10', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName
