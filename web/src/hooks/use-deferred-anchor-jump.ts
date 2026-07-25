import { useRef } from 'react'

import { useStickyScroll } from './use-sticky-scroll'

/** Result returned by {@link useDeferredAnchorJump}. */
export type UseDeferredAnchorJumpResult = {
  /** Notes the anchor to come to rest at, replacing any anchor already armed. */
  armJump: (anchorId: string) => void
  /** Makes the armed jump and disarms it, doing nothing when none is armed. */
  runArmedJump: () => void
}

/**
 * A jump to an anchor on the page the reader is already on, held back until whatever covers that page has
 * finished leaving. The caller arms the jump as the cover starts closing and makes it from that cover's own
 * "I have left" callback, so the scroll has the page to itself.
 *
 * The URL comes to name the anchor without a navigation, so a jump can never take the reader off the page.
 *
 * @returns The controls to arm a jump and to make it.
 */
export function useDeferredAnchorJump(): UseDeferredAnchorJumpResult {
  // The anchor a jump is waiting on, or null when no jump is armed. A ref rather than state: nothing renders
  // from it, and the callback that makes the jump would otherwise close over a stale value.
  const pendingAnchorId = useRef<string | null>(null)

  // Scrolling that lands the anchor clear of the sticky header
  const { scrollToElement } = useStickyScroll()

  // A function which notes where the reader is headed
  const armJump = (anchorId: string) => {
    pendingAnchorId.current = anchorId
  }

  // A function which takes the reader to the anchor that was armed
  const runArmedJump = () => {
    // Nothing armed, so there is no jump to make
    if (pendingAnchorId.current === null) {
      return
    }

    // Take the jump, so a later call doesn't repeat it
    const anchorId = pendingAnchorId.current
    pendingAnchorId.current = null

    // Point the URL at the anchor while leaving the page where it stands, spelled out in full so it can
    // only ever name the page it is on
    const { pathname, search } = window.location
    window.history.replaceState(null, '', `${pathname}${search}#${anchorId}`)

    // Let the cover's removal settle before measuring where the anchor sits
    requestAnimationFrame(() => scrollToElement(document.getElementById(anchorId)))
  }

  // Hand back the jump controls
  return { armJump, runArmedJump }
}
