'use client'

import {
  FloatingFocusManager,
  FloatingPortal,
  type Placement,
  useClick,
  useDismiss,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react'
import * as React from 'react'
import { useState } from 'react'

import { useFloatingPanel } from '@/hooks/use-floating-panel'

/**
 * Props for the {@link Tooltip} component.
 */
type TooltipProps = {
  /** The content to display inside the tooltip popover. */
  content: React.ReactNode
  /** The element that triggers the tooltip on hover or focus. */
  children: React.ReactNode
  /** The preferred placement of the tooltip.*/
  placement: Placement
  /** Optional additional class names for custom styling of the tooltip popover. */
  className?: string
}

/**
 * A trigger element's own props, as far as the tooltip has to read them: the handlers it composes
 * with its own, and the handle it shares with the positioning.
 */
type TooltipTriggerProps = React.HTMLAttributes<HTMLElement> & {
  /** The handle the trigger's owner put on it. */
  ref?: React.Ref<HTMLElement>
}

/**
 * A tooltip which works on both desktop (on hover) and tablet (on click)
 *
 * @param {TooltipProps} props - The props for the component.
 */
export function Tooltip({ children, content, placement, className = '' }: TooltipProps) {
  // Track if the tooltip is open or closed
  const [open, setOpen] = useState(false)

  // Set up floating UI logic for tooltip positioning and sizing
  const { x, y, refs, context } = useFloatingPanel({
    // Preferred tooltip placement (top, bottom, left, right). The sides to fall back to are left to
    // floating-ui, which derives them from this one, since callers pass every side
    placement,
    // Free to re-flip as the page moves under the trigger, which keeps a tooltip on screen
    pinSide: false,
    // Currently open/closed state of tooltip
    open,
    // Called when open state changes (on hover/click)
    onOpenChange: setOpen,
    // Gap between the trigger and the tooltip
    gap: 5,
    // How much of the viewport's edge it keeps clear
    padding: 16,
    // Constrain the tooltip width/height to fit within available space
    applySize({ availableWidth, availableHeight, elements }) {
      // Cap max width to reduce excessive wrapping while keeping tooltips readable
      const maxWidth = Math.min(availableWidth, 480)
      elements.floating.style.maxWidth = `${maxWidth}px`
      elements.floating.style.maxHeight = `${availableHeight}px`
    },
  })

  // Set up interactions for tooltip trigger and floating content
  // These hooks return props that need to be spread onto the trigger and floating elements
  const { getReferenceProps, getFloatingProps } = useInteractions([
    // Open tooltip on hover (with short delay/rest, disables on touch)
    useHover(context, { move: false, restMs: 80, mouseOnly: true }),
    // Also open tooltip on click (touch devices etc.)
    useClick(context, { ignoreMouse: true }),
    // Allow dismissing tooltip via outside click, Escape key, or ancestor scroll
    useDismiss(context, {
      outsidePress: true,
      escapeKey: true,
      ancestorScroll: true,
    }),
    // Add ARIA role for accessibility
    useRole(context, { role: 'tooltip' }),
    // Enable tooltip trigger and floating content to be accessible with keyboard focus
    useFocus(context),
  ])

  // The trigger, read as an element so its own props can be handed back to it
  const triggerElement = children as React.ReactElement<TooltipTriggerProps>

  // Its own click and handle, the two the tooltip has something of its own to put in place of
  const { onClick: triggerOnClick, ref: triggerRef, ...triggerProps } = triggerElement.props

  // Its remaining handlers. Only these need forwarding: cloning leaves every other prop where it
  // is, while floating-ui's own handlers overwrite whichever of these it also declares.
  const triggerHandlers = Object.fromEntries(
    Object.entries(triggerProps).filter(([propName]) => propName.startsWith('on'))
  )

  // One handle serving the trigger's owner and the positioning both
  const referenceRef = useMergeRefs([refs.setReference, triggerRef ?? null])

  return (
    <>
      {/* The trigger element. We clone the child to attach the necessary props and ref. */}
      {React.cloneElement(
        triggerElement,
        getReferenceProps({
          // Handed to floating-ui rather than applied on top of it, since it composes what it is given
          // with its own handlers while cloning would drop whichever it also declares
          ...triggerHandlers,
          ref: referenceRef,
          /**
           * Runs the trigger's own click and keeps it off everything around it.
           *
           * The default action is cancelled: a trigger is regularly an inert zone inside a label or
           * a link, where revealing what a truncated name says must not also tick the checkbox that
           * label stands for.
           *
           * @param event - The click on the trigger.
           */
          onClick(event: React.MouseEvent<HTMLElement>) {
            // What the child was going to do about being clicked
            triggerOnClick?.(event)

            // Whatever the trigger sits inside is not what the click was for
            event.preventDefault()
            event.stopPropagation()
          },
        })
      )}

      {/* The tooltip popover */}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              {...getFloatingProps({
                ref: refs.setFloating,
                // `duration-150` and `ease-out` feed the enter animation through `--tw-duration` and
                // `--tw-ease`, but they also emit the transition longhands, and `transition-property`
                // defaults to `all`. Without `transition-none` the popover animates `top`/`left` from 0,0.
                className: `z-tooltip max-h-48 animate-in overflow-y-auto rounded-lg bg-surface/95 px-3 py-1.5 text-sm text-foreground shadow-lg backdrop-blur-sm duration-150 ease-out fade-in zoom-in-95 transition-none motion-reduce:animate-none ${className}`,
                style: {
                  position: context.strategy,
                  top: y ?? 0,
                  left: x ?? 0,
                  overflowWrap: 'break-word',
                  lineHeight: '1.5',
                },
              })}
            >
              {content}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
