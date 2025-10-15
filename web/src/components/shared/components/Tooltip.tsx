'use client'

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { AnimatePresence, motion } from 'framer-motion'
import * as React from 'react'

type TooltipProps = {
  /** The content to display inside the tooltip popover. */
  content: React.ReactNode
  /** The element that triggers the tooltip on hover or focus. */
  children: React.ReactNode
  /** The preferred placement of the tooltip. @default 'top' */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * A reusable, accessible tooltip component built with Floating UI and Framer Motion.
 * It appears on hover or focus of its child element.
 *
 * @param {TooltipProps} props - The props for the component.
 * @example
 * <Tooltip content="This is a tooltip">
 *   <button>Hover me</button>
 * </Tooltip>
 */
export default function Tooltip({ children, content, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = React.useState(false)

  // --- Floating UI setup for positioning ---
  // `useFloating` provides the core logic for positioning the tooltip relative to the trigger.
  // - `placement`: The desired position (e.g., 'top', 'bottom').
  // - `middleware`: An array of functions to dynamically adjust the position.
  //   - `offset(5)`: Adds a 5px gap between the trigger and the tooltip.
  //   - `flip()`: Flips the tooltip to the opposite side if it overflows the viewport.
  //   - `shift()`: Pushes the tooltip back into view if it partially overflows.
  // - `whileElementsMounted: autoUpdate`: Keeps the tooltip position updated on scroll or resize.
  const { x, y, refs, context } = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    middleware: [offset(5), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  // --- Floating UI Interactions ---
  // These hooks manage the tooltip's visibility based on user interactions.
  // - `useHover`: Shows the tooltip on mouse hover.
  // - `useFocus`: Shows the tooltip when the trigger element receives focus.
  // - `useDismiss`: Closes the tooltip when clicking outside or pressing Escape.
  // - `useRole`: Adds the appropriate ARIA role (`role="tooltip"`) for accessibility.
  const hover = useHover(context, { move: false })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  // `useInteractions` combines all the interaction hooks into props for the trigger and floating elements.
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  return (
    <>
      {/* The trigger element. We clone the child to attach the necessary props and ref. */}
      {React.cloneElement(
        children as React.ReactElement,
        getReferenceProps({ ref: refs.setReference })
      )}

      {/* The tooltip popover, rendered conditionally with a presence animation. */}
      <AnimatePresence>
        {open && (
          <FloatingPortal>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              {...getFloatingProps({
                ref: refs.setFloating,
                className:
                  'z-50 max-w-xs rounded-lg bg-slate-700/95 px-3 py-1.5 text-sm text-slate-100 shadow-lg backdrop-blur-sm',
                style: {
                  position: context.strategy,
                  top: y ?? 0,
                  left: x ?? 0,
                },
              })}
            >
              {content}
            </motion.div>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </>
  )
}
