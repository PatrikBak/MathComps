'use client'

import {
  autoUpdate,
  flip,
  offset,
  type Placement,
  shift,
  size,
  type SizeOptions,
  useFloating,
  type UseFloatingOptions,
  type UseFloatingReturn,
} from '@floating-ui/react'
import { useIsomorphicEffect } from '@mantine/hooks'
import { useRef, useState } from 'react'

/**
 * How a panel's sizing rule is told what room it has.
 */
type ApplyPanelSize = NonNullable<SizeOptions['apply']>

/**
 * What {@link useFloatingPanel} takes on top of what it hands straight to floating-ui.
 */
type FloatingPanelOptions = Omit<
  UseFloatingOptions,
  'middleware' | 'placement' | 'whileElementsMounted' | 'open'
> & {
  /** Whether the panel is showing. */
  open: boolean
  /** The side to open on. */
  placement: Placement
  /** The sides to try once that one has no room, or undefined to let floating-ui pick them. */
  fallbackPlacements?: Placement[]
  /** Whether the side the panel opened on is kept for as long as it stays open. */
  pinSide: boolean
  /** How far the panel clears its trigger. */
  gap: number
  /** How much of the viewport's edge the panel keeps clear. */
  padding: number
  /** The panel's own sizing rule. */
  applySize: ApplyPanelSize
}

/**
 * Positions a floating panel: clear of its trigger, on a side with room, and sized to what it finds
 * there. The house wrapper around floating-ui.
 *
 * `pinSide` is the one thing panels disagree on. A panel whose content resizes while it is open — one
 * with a search box, a collapsible section, an expanding tree — hands flipping a new answer on every
 * keystroke: it opens upward for want of room below, a query narrows it enough to fit below, and
 * clearing the query leaves it below and overflowing. Pinning settles the side once, on opening. A
 * panel holding something fixed is better off free to re-flip as the page moves under it.
 *
 * @param options - Where the panel goes, how it is sized, and whether its side is pinned.
 *
 * @returns Everything floating-ui returns, with the settled side standing in for the live one.
 */
export function useFloatingPanel({
  open,
  placement,
  fallbackPlacements,
  pinSide,
  gap,
  padding,
  applySize,
  ...floatingOptions
}: FloatingPanelOptions): UseFloatingReturn {
  // The side the panel settled on when it opened, once it has one
  const [pinnedPlacement, setPinnedPlacement] = useState<Placement | null>(null)

  // The sizing rule as it stands now, reached through a handle so that the rule reading it never changes
  // shape. Spelled inline it would, to floating-ui's eye, never change at all (see the chain below), and
  // the panel would keep sizing itself by what the first render captured.
  const applySizeRef = useRef(applySize)

  // Kept current in a layout effect, which is where floating-ui measures from
  useIsomorphicEffect(() => {
    applySizeRef.current = applySize
  })

  // Where the panel goes and how big it may be
  const floating = useFloating({
    ...floatingOptions,
    open,
    placement: pinnedPlacement ?? placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      // Clear of the trigger
      offset(gap),

      // Onto whichever side has room, until one is settled on. Dropping the rule outright is what makes
      // the pin hold: floating-ui keeps the chain it was first given and only replaces it once a new one
      // differs, comparing each rule's function by its source text, which two closures spelled the same
      // way never do. A shorter chain is the difference it does notice.
      ...(pinnedPlacement === null ? [flip({ fallbackPlacements, padding })] : []),

      // Nudged along the viewport rather than allowed to hang off its edge
      shift({ padding }),

      // Sized to what the side it is on leaves
      size({ padding, apply: (state) => applySizeRef.current(state) }),
    ],
  })

  // Whether the panel is on the page. A pin is held against this rather than against the open flag
  // because a panel animating away is already flagged closed while still on screen, and letting
  // flipping back into the chain there moves it to the other side halfway through the fade.
  const isMounted = floating.elements.floating !== null

  // Take the side of the first placement the panel is given, and give it back once the panel goes, so
  // the next opening decides again from where the trigger stands then
  if (!isMounted) {
    if (pinnedPlacement !== null) setPinnedPlacement(null)
  } else if (pinSide && floating.isPositioned && pinnedPlacement === null) {
    setPinnedPlacement(floating.placement)
  }

  return {
    ...floating,

    // The side to render against. floating-ui holds its last measurement through a close, so the first
    // renders of a reopening still read the side the panel closed on; a caller dressing the panel by
    // its side would flash that one before the real measurement lands.
    placement: pinnedPlacement ?? (floating.isPositioned ? floating.placement : placement),
  }
}
