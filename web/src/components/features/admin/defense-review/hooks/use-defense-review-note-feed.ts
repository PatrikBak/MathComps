import { type RefObject, useRef, useState } from 'react'

/**
 * What {@link useDefenseReviewNoteFeed} hands back.
 */
export type UseDefenseReviewNoteFeedResult = {
  /** Whether every note ever written is showing. */
  isFeedOpen: boolean
  /** Shows every note ever written. */
  openFeed: () => void
  /** Puts the notes away. */
  closeFeed: () => void
  /** The control the feed is opened from. */
  feedButtonRef: RefObject<HTMLButtonElement | null>
  /** The note the reader was sent to out of the feed; null for a conversation opened on its own account. */
  landingNoteId: string | null
  /** Opens the conversation a note in the feed was written about, landing on the note. */
  openNote: (sessionId: string, noteId: string) => void
  /**
   * Puts focus back on the feed's button for a conversation opened from a note, and forgets the note. Run once the
   * conversation dialog has finished leaving.
   */
  handleConversationClosed: () => void
}

/**
 * The feed of every note ever written, and the way from a note in it into its conversation and back.
 *
 * Closing a conversation opened from the feed hands focus back to the feed's button, since the note it was
 * opened from has gone with the feed.
 *
 * @param openConversation - Opens one conversation of the queue.
 * @returns The feed as described by {@link UseDefenseReviewNoteFeedResult}.
 */
export function useDefenseReviewNoteFeed(
  openConversation: (sessionId: string) => void
): UseDefenseReviewNoteFeedResult {
  // Whether every note ever written is showing
  const [isFeedOpen, setIsFeedOpen] = useState(false)

  // The note the reader was sent to out of the feed, which the conversation then opens on
  const [landingNoteId, setLandingNoteId] = useState<string | null>(null)

  // The control the feed is opened from
  const feedButtonRef = useRef<HTMLButtonElement>(null)

  // A function which shows the feed
  const openFeed = () => setIsFeedOpen(true)

  // A function which puts the feed away
  const closeFeed = () => setIsFeedOpen(false)

  // A function which goes from a note in the feed to its conversation
  const openNote = (sessionId: string, noteId: string) => {
    // The feed goes on the way through, since a conversation opened under it would stack two dialogs
    setIsFeedOpen(false)

    // Which note the conversation is being opened for
    setLandingNoteId(noteId)

    // Open the conversation itself
    openConversation(sessionId)
  }

  // A function which settles up once the conversation has gone
  const handleConversationClosed = () => {
    // Opened from a note in the feed, so back to the control the feed was opened from
    if (landingNoteId !== null) feedButtonRef.current?.focus({ preventScroll: true })

    // Whatever the reader was sent to has been read by now, so the next open is nobody's note
    setLandingNoteId(null)
  }

  // The feed, and the way through it
  return {
    isFeedOpen,
    openFeed,
    closeFeed,
    feedButtonRef,
    landingNoteId,
    openNote,
    handleConversationClosed,
  }
}
