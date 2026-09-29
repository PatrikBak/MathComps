import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'

import {
  findFirstTurnAfter,
  findReadPassBefore,
} from '@/components/features/defense/model/defense-conversation-model'
import { useKeyedState } from '@/hooks/use-keyed-state'

import type { AdminConversation } from '../model/admin-conversation'
import { conversationDetailKeyPrefix } from './conversation-cache'
import type { MarkUnreadFrom } from './use-conversation-read-state'

/**
 * How one conversation stands after this dialog session has been through it.
 */
type ConversationReadingPass = {
  /** How the reader left it: true while it counts as read. */
  isRead: boolean
  /** Where the pass stopped: the first turn left to read, null while nothing is. */
  firstNewTurnId: string | null
  /** Whether the conversation has arrived and been recorded. */
  hasArrived: boolean
}

/**
 * Works out where the reader's last pass through a conversation stopped.
 *
 * @param conversation - The conversation as it arrived; null while it hasn't.
 * @returns The first turn left to read; null while nothing marks one.
 */
function stoppedAtOf(conversation: AdminConversation | null): string | null {
  // The first turn past the read stamp the conversation arrived with
  return conversation === null
    ? null
    : (findFirstTurnAfter(conversation.turns, conversation.readAt)?.id ?? null)
}

/**
 * What {@link useConversationReadMarking} hands back.
 */
export type UseConversationReadMarkingResult = {
  /** Whether the conversation currently counts as read. */
  isRead: boolean
  /** The first turn left to read since the reader's last pass; null while nothing marks one. */
  firstNewTurnId: string | null
  /** Flips whether it counts as read. */
  toggleRead: () => void
  /** Picks the conversation up again from one of its turns, leaving it and everything after it to read. */
  markUnreadFrom: (turnId: string) => void
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
 * said before this open: reading the toggle off that stamp would leave it offering to mark read something opening
 * it has already marked read, and would put marking it unread out of reach on exactly the conversations worth
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
 * @param onMarkUnreadFrom - {@link MarkUnreadFrom}.
 * @returns The state described by {@link UseConversationReadMarkingResult}.
 */
export function useConversationReadMarking(
  detail: AdminConversation | null,
  sessionId: string | null,
  onMarkRead: (sessionId: string) => void,
  onMarkUnread: (sessionId: string) => void,
  onMarkUnreadFrom: MarkUnreadFrom
): UseConversationReadMarkingResult {
  // The cache the conversations were read into
  const queryClient = useQueryClient()

  // Every conversation this dialog session has been through, by the id it was read under
  const passesRef = useRef(new Map<string, ConversationReadingPass>())

  // Which conversation is open as of the latest render, for a refusal that lands after the reader moved on
  const openSessionIdRef = useRef(sessionId)
  openSessionIdRef.current = sessionId

  // How this dialog session left the conversation now being read
  const heldPass = sessionId === null ? undefined : passesRef.current.get(sessionId)

  // The conversation being read, once it has arrived
  const arrived = detail !== null && detail.id === sessionId ? detail : null

  // Where the last pass through it stopped, as it stood before this open; null while nothing was left to read.
  // It belongs to the conversation it was read off, so it means nothing in the next one, and it is there from
  // the render the conversation arrives in, so whatever opens at it opens at the right turn.
  const [firstNewTurnId, setFirstNewTurnId] = useKeyedState<string | null>(
    arrived?.id ?? null,
    heldPass?.hasArrived === true ? heldPass.firstNewTurnId : stoppedAtOf(arrived)
  )

  // Whether it currently counts as read, which is likewise the open conversation's own answer. One on its way
  // already counts, since its arrival marks it read, so the toggle keeps its words while the reader steps.
  const [isRead, setIsRead] = useKeyedState(sessionId, heldPass?.isRead ?? true)

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

    // Where the last pass stopped, read off the stamp before the mark below moves it. The conversation is read
    // again on every note write, and by then its stamp says now, so this response is the only place it survives.
    const stoppedAt = stoppedAtOf(detail)

    // Having it open counts as having read it, unless the reader flagged it otherwise while it was on its way
    const isReadNow = pass?.isRead ?? true

    // Record that, which the reader's own flag has already done wherever it says otherwise
    if (isReadNow) onMarkRead(sessionId)

    // And hold it, so the toggle offers the move still available
    setIsRead(isReadNow)

    // Held against the conversation too, so stepping back onto it restores this rather than repeating it
    passesRef.current.set(sessionId, {
      isRead: isReadNow,
      firstNewTurnId: stoppedAt,
      hasArrived: true,
    })
  }, [detail, sessionId, onMarkRead, setIsRead])

  // Flips the mark, holding the new state so the toggle keeps offering the other move
  const toggleRead = useCallback(() => {
    // Nothing to mark while no conversation is open
    if (sessionId === null) return

    // Whichever move the mark currently isn't
    const nextIsRead = !isRead

    // Record whichever move that is
    if (nextIsRead) onMarkRead(sessionId)
    else onMarkUnread(sessionId)

    // Where that leaves the reading, which the mark decides outright: read reaches the end of the
    // conversation, and taking it back reaches nothing, so the first turn left to read is the first of them.
    // Either way the line has to move, or it goes on naming a turn as where the next pass starts.
    const nextFirstNewTurnId =
      nextIsRead || detail?.id !== sessionId ? null : (detail.turns[0]?.id ?? null)

    // Hold where that leaves it, so the toggle offers the other one
    setIsRead(nextIsRead)
    setFirstNewTurnId(nextFirstNewTurnId)

    // And hold it against the conversation
    passesRef.current.set(sessionId, {
      isRead: nextIsRead,
      firstNewTurnId: nextFirstNewTurnId,
      hasArrived: passesRef.current.get(sessionId)?.hasArrived ?? false,
    })
  }, [sessionId, detail, isRead, onMarkRead, onMarkUnread, setIsRead, setFirstNewTurnId])

  // Moves where the reader picks the conversation up, which is the same move the mark above makes wholesale
  const markUnreadFrom = useCallback(
    (turnId: string) => {
      // Nothing to pick up while no conversation is open, or while the one open is still on its way
      if (sessionId === null || detail === null || detail.id !== sessionId) return

      // Where that leaves the pass, worked out the way the server works it out
      const boundary = findReadPassBefore(detail.turns, turnId)

      // How this dialog session left it, for one it has already been through
      const held = passesRef.current.get(sessionId)

      // How the conversation stands now, which is what a refused write has to put back
      const settled: ConversationReadingPass = {
        isRead,
        firstNewTurnId,
        hasArrived: held?.hasArrived ?? false,
      }

      // Puts back what the move changed, for a write the server turns down. The queue's cached row rolls back on
      // its own; without this the transcript would go on showing a mark nothing recorded.
      const restore = () => {
        // Held against the conversation, which is what stepping back onto it reads
        passesRef.current.set(sessionId, settled)

        // Shown only while it is still the one open, since the answers on screen by now may be another's
        if (openSessionIdRef.current !== sessionId) return

        // Where the pass stopped and whether it counts as read, back as they were
        setFirstNewTurnId(settled.firstNewTurnId)
        setIsRead(settled.isRead)
      }

      // Record the move
      onMarkUnreadFrom(sessionId, turnId, boundary, restore)

      // The line marking what is new moves to the turn
      setFirstNewTurnId(boundary.firstNewTurnId)

      // And the conversation stops counting as read
      setIsRead(false)

      // Held against the conversation too
      passesRef.current.set(sessionId, {
        isRead: false,
        firstNewTurnId: boundary.firstNewTurnId,
        hasArrived: settled.hasArrived,
      })
    },
    [sessionId, detail, isRead, firstNewTurnId, onMarkUnreadFrom, setIsRead, setFirstNewTurnId]
  )

  // Puts the whole session back to never having happened, so the next open reads each conversation afresh
  const reset = useCallback(() => {
    // Each copy read on the way through, whose stamp is the one from before the session moved it. Dropped
    // rather than refreshed, since a stale copy is still served for the render the next open reads it in.
    for (const visitedSessionId of passesRef.current.keys()) {
      queryClient.removeQueries({ queryKey: conversationDetailKeyPrefix(visitedSessionId) })
    }

    // Nothing has been through here
    passesRef.current.clear()
  }, [queryClient])

  // How the conversation stands with the reader, and where it picks up from
  return { isRead, firstNewTurnId, toggleRead, markUnreadFrom, reset }
}
