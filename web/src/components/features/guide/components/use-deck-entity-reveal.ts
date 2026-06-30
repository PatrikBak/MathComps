import { useTimeout } from '@mantine/hooks'
import { useEffect, useState } from 'react'

import { useStickyScroll } from '@/hooks/use-sticky-scroll'

import { useGuideDeck } from './guide-deck-context'

/** How long the reveal ring lingers before fading, in ms. */
const RING_DURATION_MS = 1600

/** A little breathing room above a revealed card, beyond the sticky header, in px. */
const SCROLL_GAP_PX = 16

/** Result returned by {@link useDeckEntityReveal}. */
export type UseDeckEntityRevealResult = {
  /** Whether the transient highlight ring is currently showing on this card. */
  revealed: boolean
}

/**
 * Reveals a guide card when the deck deep-links to it: scrolls it clear of the sticky header, pulses a
 * transient highlight ring, and runs {@link onReveal} (e.g. to open the card's modal), then consumes the
 * request. Inert for every card except the one the deck currently targets. When the reveal opens a modal,
 * the ring waits until that modal closes so it isn't spent pulsing behind the panel.
 *
 * @param id - The card's entity id; the reveal fires when the deck requests this id.
 * @param onReveal - Side effect to run on reveal (e.g. the card opening its modal, when it has one).
 * @param modalOpen - Whether the card's modal is currently open; the ring holds until it closes.
 *
 * @returns Whether the transient highlight ring is currently showing.
 */
export function useDeckEntityReveal(
  id: string,
  onReveal: () => void,
  modalOpen: boolean
): UseDeckEntityRevealResult {
  // The pending deep-link request, the sticky tab bar to clear, and the way to consume the request
  const { openEntityId, clearOpenEntity, stickyTabBarHeight } = useGuideDeck()
  // Window-scroll helper that lands the card under the sticky header
  const { scrollToElement } = useStickyScroll()
  // Whether the highlight ring is showing
  const [revealed, setRevealed] = useState(false)
  // A reveal landed and the ring is owed, waiting for any open modal to close before it pulses
  const [armed, setArmed] = useState(false)
  // A self-clearing timer that drops the ring after a beat (auto-cleared on unmount)
  const { start: startRingTimer } = useTimeout(() => setRevealed(false), RING_DURATION_MS)

  // React to a deep-link aimed at this card
  useEffect(() => {
    // Ignore requests for other cards
    if (openEntityId !== id) return
    // Run the caller's reveal side effect (open the modal, when there is one)
    onReveal()
    // Owe the ring; it pulses once the card is actually visible (no modal in the way)
    setArmed(true)
    // Scroll the card into view once the active slide has settled (all slides are mounted, so it's reachable),
    // clearing the sticky tab bar on top of the header so the card's (possibly wrapped) title isn't hidden
    requestAnimationFrame(() =>
      scrollToElement(document.getElementById(id), { gap: SCROLL_GAP_PX + stickyTabBarHeight })
    )
    // Consume the request so it can't re-fire
    clearOpenEntity()
  }, [openEntityId, id, onReveal, clearOpenEntity, scrollToElement, stickyTabBarHeight])

  // Pay the owed ring once nothing covers the card; a modal-bearing reveal waits for its close
  useEffect(() => {
    // Nothing owed, or the modal still covers the card
    if (!armed || modalOpen) return
    // Pulse the highlight ring
    setRevealed(true)
    // Drop it after a beat
    startRingTimer()
    // The debt is paid
    setArmed(false)
  }, [armed, modalOpen, startRingTimer])

  // Whether to draw the ring this render
  return { revealed }
}
