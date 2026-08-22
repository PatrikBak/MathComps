'use client'

import type { UseFloatingReturn } from '@floating-ui/react'

import { useFloatingPanel } from '@/hooks/use-floating-panel'

/** How far a select's panel clears its trigger, and how much of the viewport's edge it keeps clear. */
const SELECT_PANEL_GAP = 8

/** The tallest a select's panel may stand, whatever room the viewport leaves it. */
const SELECT_PANEL_MAX_HEIGHT = '32vh'

/**
 * Positions the panel both selects open: under their trigger where there is room and above it where
 * there is not, as wide as the trigger, and never past a third of the page. The side is pinned, which
 * the searchable one needs, since its list shrinks as the user types.
 *
 * @param open - Whether the panel is showing.
 * @param triggerElement - The trigger the panel hangs off, once React has handed it over.
 *
 * @returns Everything floating-ui returns, of which a panel needs `refs.setFloating` and `floatingStyles`.
 */
export function useSelectPanel(
  open: boolean,
  triggerElement: HTMLElement | null
): UseFloatingReturn {
  // The panel's side, place and size
  return useFloatingPanel({
    open,
    elements: { reference: triggerElement },
    placement: 'bottom-start',
    fallbackPlacements: ['top-start'],
    pinSide: true,
    strategy: 'fixed',
    gap: SELECT_PANEL_GAP,
    padding: SELECT_PANEL_GAP,
    applySize({ availableWidth, availableHeight, rects, elements }) {
      // Written straight onto the element, since these change as the page moves
      Object.assign(elements.floating.style, {
        // As wide as the trigger it drops from
        width: `${rects.reference.width}px`,
        maxWidth: `${availableWidth}px`,
        maxHeight: `min(${SELECT_PANEL_MAX_HEIGHT}, ${availableHeight}px)`,
      })
    },
  })
}
