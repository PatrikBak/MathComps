import { useCallback, useEffect, useRef } from 'react'

import { findFirstTurnAfter } from '@/components/features/defense/model/defense-conversation-model'
import type { StoredTurn } from '@/components/features/defense/model/defense-types'
import { useKeyedState } from '@/hooks/use-keyed-state'

import type { DefenseReviewDetail } from '../model/defense-review-types'

/**
 * How one conversation stands after this dialog session has been through it.
 */
type ConversationReadingPass = {
  /** How the reader left it: true while it counts as read. */
  isRead: boolean
  /** When the pass before this dialog session stopped; null while nobody had read it. */
  readAtBoundary: string | null
  /** Whether the conversation has arrived and been recorded. */
  hasArrived: boolean
}

/**
 * What {@link useDefenseReviewReadMarking} hands back.
 */
type UseDefenseReviewReadMarkingResult = {
  /** Whether the conversation currently counts as read. */
  isRead: boolean
  /** The first turn to have arrived since the reader's last pass; null while nothing marks one. */
  firstNewTurn: StoredTurn | null
  /** Flips whether it counts as read. */
  toggleRead: () => void
  /** Forgets every conversation this dialog session went through. */
  reset: () => void
}

/**
 * Records that a conversation has been read, and works out where the reader's last pass through it stopped.
 *
 * The two belong together because they read the same stamp in opposite directions: opening a conversation moves
 * it to now, and marking what is new needs the value it held before that. So the pre-open stamp is caught here
 * on the way past, in the one place that also moves it.
 *
 * Whether it counts as read is held rather than derived from the response, whose stamp stays frozen at what it
 * said before this open: reading the toggle off that stamp would leave it offering to mark read something the
 * queue already shows read, and would put marking it unread out of reach on exactly the conversations worth
 * re-flagging.
 *
 * Every conversation this dialog session has walked through is held, so stepping back onto one puts back what
 * the reader left rather than reading it a second time: one they flagged unread by hand stays unread however
 * many times they pass it, and the line marking what is new stays where the first pass drew it. Both answers
 * belong to the conversation they were given for, so one still on its way is never shown the answer the one
 * before it got.
 *
 * @param detail - The conversation as it arrived; null while it hasn't.
 * @param sessionId - The conversation being read; null while none is.
 * @param onMarkRead - Records that a conversation has been read as of now.
 * @param onMarkUnread - Takes that record back.
 * @returns The state described by {@link UseDefenseReviewReadMarkingResult}.
 */
export function useDefenseReviewReadMarking(
  detail: DefenseReviewDetail | null,
  sessionId: string | null,
  onMarkRead: (sessionId: string) => void,
  onMarkUnread: (sessionId: string) => void
): UseDefenseReviewReadMarkingResult {
  // Every conversation this dialog session has been through, by the id it was read under
  const passesRef = useRef(new Map<string, ConversationReadingPass>())

  // How this dialog session left the conversation now being read
  const heldPass = sessionId === null ? undefined : passesRef.current.get(sessionId)

  // When the last pass through it stopped, as it stood before this open; null while nobody has read it. It
  // belongs to the conversation it was read off, so it means nothing in the next one.
  const [readAtBoundary, setReadAtBoundary] = useKeyedState<string | null>(
    sessionId,
    heldPass?.readAtBoundary ?? null
  )

  // Whether it currently counts as read, which is likewise the open conversation's own answer
  const [isRead, setIsRead] = useKeyedState(sessionId, heldPass?.isRead ?? false)

  // Opening a conversation is what counts as having read it, whether it was clicked or stepped to. It waits for
  // the conversation itself, for two reasons: the read stamp the transcript marks what is new from is the one
  // this response carries, and until it lands there is no telling whether the client was ready to send anything.
  useEffect(() => {
    // Nothing to record until the conversation that arrived is the one being read
    if (detail === null || detail.id !== sessionId) return

    // How this dialog session left it, for one it has already been through
    const pass = passesRef.current.get(sessionId)

    // A second arrival is a refetch or a step back onto it, and either way the reader has already had it: the
    // answers they left are put back by the state above, and marking it again would undo a flag they made
    if (pass?.hasArrived === true) return

    // Where the last pass stopped, held before the mark below moves it. The conversation is read again on every
    // note write, and by then its stamp says now, so the response's own value is the only place this survives.
    setReadAtBoundary(detail.readAt)

    // Having it open counts as having read it, unless the reader flagged it otherwise while it was on its way
    const isReadNow = pass?.isRead ?? true

    // Record that, which the reader's own flag has already done wherever it says otherwise
    if (isReadNow) onMarkRead(sessionId)

    // And hold it, so the toggle offers the move still available
    setIsRead(isReadNow)

    // Held against the conversation too, so stepping back onto it restores this rather than repeating it
    passesRef.current.set(sessionId, {
      isRead: isReadNow,
      readAtBoundary: detail.readAt,
      hasArrived: true,
    })
  }, [detail, sessionId, onMarkRead, setIsRead, setReadAtBoundary])

  // The first turn to have arrived since that pass
  const firstNewTurn = detail === null ? null : findFirstTurnAfter(detail.turns, readAtBoundary)

  // Flips the mark, holding the new state so the toggle keeps offering the other move
  const toggleRead = useCallback(() => {
    // Nothing to mark while no conversation is open
    if (sessionId === null) return

    // Whichever move the mark currently isn't
    const nextIsRead = !isRead

    // Say so
    if (nextIsRead) onMarkRead(sessionId)
    else onMarkUnread(sessionId)

    // Hold where that leaves it, so the toggle offers the other one
    setIsRead(nextIsRead)

    // And hold it against the conversation
    passesRef.current.set(sessionId, {
      isRead: nextIsRead,
      readAtBoundary,
      hasArrived: passesRef.current.get(sessionId)?.hasArrived ?? false,
    })
  }, [sessionId, isRead, readAtBoundary, onMarkRead, onMarkUnread, setIsRead])

  // Puts the whole session back to never having happened, so the next open reads each conversation afresh
  const reset = useCallback(() => {
    // Nothing has been through here
    passesRef.current.clear()
  }, [])

  // How the conversation stands with the reader, and where it picks up from
  return { isRead, firstNewTurn, toggleRead, reset }
}
