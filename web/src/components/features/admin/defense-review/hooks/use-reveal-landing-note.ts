import { type RefObject, useEffect } from 'react'

/**
 * Brings the note a reader was sent to into view.
 *
 * A note reached from the cross-conversation feed can hang anywhere down a conversation's list, and one left
 * below the fold reads as the wrong conversation having opened.
 *
 * @param paneRef - The scrolling pane the notes are read in.
 * @param landingNoteId - The note to move to; null when the reader came in for the conversation itself.
 */
export function useRevealLandingNote(
  paneRef: RefObject<HTMLDivElement | null>,
  landingNoteId: string | null
): void {
  // Move to it, once the notes are on screen
  useEffect(() => {
    // Nothing to move to in a conversation opened on its own account
    if (landingNoteId === null) return

    // The card standing for it, which is there only if the note was written about this conversation
    const card = paneRef.current?.querySelector(`[data-note-id="${CSS.escape(landingNoteId)}"]`)

    // Centred, so what was written around it reads too
    card?.scrollIntoView({ block: 'center' })
  }, [paneRef, landingNoteId])
}
