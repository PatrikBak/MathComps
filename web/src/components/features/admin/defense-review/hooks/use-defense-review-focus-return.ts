import { useCallback, useRef } from 'react'

/**
 * What {@link useDefenseReviewFocusReturn} hands back.
 */
type UseDefenseReviewFocusReturnResult = {
  /** Handle onto the control the notes feed is opened from. */
  feedButtonRef: React.RefObject<HTMLButtonElement | null>
  /** Opens a conversation from its card in the queue. */
  openFromCard: (sessionId: string) => void
  /** Opens a conversation from a note in the cross-conversation feed. */
  openFromFeed: (sessionId: string) => void
  /** Puts focus back where the open began, to be run once the dialog has finished leaving. */
  restoreFocus: () => void
}

/**
 * Sends focus back to whatever the reader opened a conversation from, once they have closed it.
 *
 * The dialog's own restore can't do this. It points at whatever was clicked, which stops being the conversation
 * on screen as soon as the reader steps along with j/k, and it points at nothing at all for one opened from the
 * notes feed, since that feed has closed by then. So both origins are tracked here, and a card is found again by
 * the id it is stamped with rather than by having been the element clicked.
 *
 * Nothing moves the page on the way back: `focus()` brings its target into view by default, and after a run of
 * j/k the conversation the reader ended on can be a long way from where they were reading.
 *
 * @param openId - The conversation currently open; null while none is.
 * @param openConversation - Opens one for reading.
 * @returns The handles described by {@link UseDefenseReviewFocusReturnResult}.
 */
export function useDefenseReviewFocusReturn(
  openId: string | null,
  openConversation: (sessionId: string) => void
): UseDefenseReviewFocusReturnResult {
  // The conversation the reader ended on, held past the point the selection clears it so its card can still be
  // found once the dialog has finished leaving
  const lastOpenIdRef = useRef<string | null>(null)

  // Kept up with while something is open, and left standing once nothing is
  if (openId !== null) lastOpenIdRef.current = openId

  // The control the feed is opened from
  const feedButtonRef = useRef<HTMLButtonElement>(null)

  // Where the open began
  const openOriginRef = useRef<'card' | 'feed'>('card')

  // Opens one from its card in the queue
  const openFromCard = useCallback(
    (sessionId: string) => {
      // Where focus goes back to once it closes
      openOriginRef.current = 'card'

      // Open it for reading
      openConversation(sessionId)
    },
    [openConversation]
  )

  // Opens one from a note in the feed
  const openFromFeed = useCallback(
    (sessionId: string) => {
      // Where focus goes back to once it closes
      openOriginRef.current = 'feed'

      // Open it for reading
      openConversation(sessionId)
    },
    [openConversation]
  )

  // Puts focus back where the open began
  const restoreFocus = useCallback(() => {
    // Where this open began
    const origin = openOriginRef.current

    // The next open is a card's until something says otherwise, since the hotkeys open one without going
    // through either handler above and would otherwise inherit whatever the last open was
    openOriginRef.current = 'card'

    // Reached through the feed
    if (origin === 'feed') {
      // Back to the control it was opened from
      feedButtonRef.current?.focus({ preventScroll: true })

      // Nothing else stands for that open
      return
    }

    // Otherwise the card of whichever conversation the reader ended on, which is not the one they clicked
    // once they have stepped along from it
    const sessionId = lastOpenIdRef.current

    // Nowhere to go back to if nothing was ever open
    if (sessionId === null) return

    // Whichever card stands for it, if the queue is still showing one
    document
      .querySelector<HTMLButtonElement>(`[data-conversation-id="${CSS.escape(sessionId)}"]`)
      ?.focus({ preventScroll: true })
  }, [])

  // The control the feed hangs off, the two ways in, and the way back
  return { feedButtonRef, openFromCard, openFromFeed, restoreFocus }
}
