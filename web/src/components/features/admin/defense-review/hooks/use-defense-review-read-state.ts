import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useRef } from 'react'

import type { ReadPassBoundary } from '@/components/features/defense/model/defense-conversation-model'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { ApiCaller } from '@/hooks/use-api'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import type { ApiResult } from '@/types/api'

import type { DefenseReviewConversation } from '../model/defense-review-types'
import {
  setDefenseReviewReadState,
  setDefenseReviewReadStates,
  setDefenseReviewUnreadFromTurn,
} from '../services/defense-review-service'
import {
  invalidateUnreadQueue,
  patchCachedQueueConversation,
  patchCachedQueueConversations,
} from './defense-review-cache'

/**
 * Stamping a conversation as read as of now.
 */
type MarkRead = {
  /** The discriminator. */
  kind: 'read'
}

/**
 * Leaving a conversation unread, as though the reviewer had never opened it.
 */
type MarkUnread = {
  /** The discriminator. */
  kind: 'unread'
}

/**
 * Picking a conversation up again from one of its turns, leaving that turn and everything after it to read.
 */
type MarkUnreadFromTurn = {
  /** The discriminator. */
  kind: 'unreadFromTurn'
  /** The turn to leave unread, along with every turn after it. */
  turnId: string
  /** Where that leaves the reader's pass through the conversation. */
  boundary: ReadPassBoundary
}

/**
 * One of the moves a reviewer can make on where they stand with a conversation.
 */
type ReadMark = MarkRead | MarkUnread | MarkUnreadFromTurn

/**
 * What one call to mark a conversation says.
 */
type ReadStateChange = {
  /** The conversation. */
  sessionId: string
  /** The move being made on it. */
  mark: ReadMark
}

/**
 * What a row said about having been read, kept so a failed write can put it back.
 */
type ReadStateSnapshot = {
  /** When it was last read, as an ISO-8601 string; null while it never had been. */
  readAt: string | null
  /** How many of its turns were new. */
  unreadTurnCount: number
}

/**
 * Every mark still settling on one conversation, held together so a failure puts back what the server holds
 * rather than what the mark before it optimistically wrote.
 */
type ReadStateMarks = {
  /** The last state the server is known to hold: what the row said before the first mark, then whatever each
   * mark that lands leaves behind. Null while the row was never on screen. */
  previous: ReadStateSnapshot | null
  /** How many of them have yet to settle. */
  outstanding: number
}

/**
 * What a mark has written, held in a slot the cache rewrite can fill and the caller can read back out.
 */
type WrittenReadState = {
  /** The row as this mark left it; null while it has written nothing. */
  value: ReadStateSnapshot | null
}

/**
 * Works out what a row says once a mark has been made on it.
 *
 * @param conversation - The row as it stands.
 * @param mark - The move being made on it.
 * @param readAt - The moment a read is recorded as of, so a set marked together reads as one pass.
 *
 * @returns The row's read state as the mark leaves it.
 */
function markedReadState(
  conversation: DefenseReviewConversation,
  mark: ReadMark,
  readAt: string
): ReadStateSnapshot {
  switch (mark.kind) {
    // Read as of then, with nothing left in it
    case 'read':
      return { readAt, unreadTurnCount: 0 }

    // Back to every reply standing unread
    case 'unread':
      return { readAt: null, unreadTurnCount: conversation.turnCount }

    // Read as far as the turn before the one it is picked up from, which is what the boundary names. Taken
    // field by field, since the boundary also carries where the transcript draws its line.
    case 'unreadFromTurn':
      return {
        readAt: mark.boundary.readAt,
        unreadTurnCount: mark.boundary.unreadTurnCount,
      }

    // Nothing else is a mark
    default:
      return assertNever(mark)
  }
}

/**
 * Sends one mark to the server.
 *
 * @param apiCall - The authenticated API caller.
 * @param change - The conversation and the move being made on it.
 *
 * @returns Nothing on success.
 */
function sendReadStateChange(
  apiCall: ApiCaller,
  { sessionId, mark }: ReadStateChange
): Promise<ApiResult<void>> {
  switch (mark.kind) {
    // Stamped as read
    case 'read':
      return setDefenseReviewReadState(apiCall, sessionId, true)

    // The stamp taken back
    case 'unread':
      return setDefenseReviewReadState(apiCall, sessionId, false)

    // The stamp moved back to just before a turn
    case 'unreadFromTurn':
      return setDefenseReviewUnreadFromTurn(apiCall, sessionId, mark.turnId)

    // Nothing else is a mark
    default:
      return assertNever(mark)
  }
}

/**
 * What one call to mark a whole set of conversations says.
 */
type BulkReadStateChange = {
  /** The conversations. */
  sessionIds: readonly string[]
  /** True to stamp them as read, false to leave them unread. */
  read: boolean
}

/**
 * Picks a conversation up again from one of its turns, leaving it and everything after it to read.
 *
 * @param sessionId - The conversation.
 * @param turnId - As in {@link MarkUnreadFromTurn.turnId}.
 * @param boundary - As in {@link MarkUnreadFromTurn.boundary}.
 * @param onRefused - Puts back whatever the caller holds of its own, for a write the server turns down.
 */
export type MarkUnreadFrom = (
  sessionId: string,
  turnId: string,
  boundary: ReadPassBoundary,
  onRefused: () => void
) => void

/**
 * What {@link useDefenseReviewReadState} hands back.
 */
type UseDefenseReviewReadStateResult = {
  /** Stamps a conversation as read as of now. */
  markRead: (sessionId: string) => void
  /** Leaves a conversation unread. */
  markUnread: (sessionId: string) => void
  /** {@link MarkUnreadFrom}. */
  markUnreadFrom: MarkUnreadFrom
  /** Marks a whole set at once, in one request and one sweep of the cached rows. */
  markMany: (sessionIds: readonly string[], read: boolean) => void
}

/**
 * Records which conversations have been read.
 *
 * The queue's rows are rewritten in place rather than read back, since refetching would reorder them under an
 * open conversation and change which one stepping forward lands on. The open conversation's own copy is left
 * alone for the same reason it is sent at all: its read stamp is the one from before this read, and refreshing
 * it would destroy the boundary marking where the last pass stopped.
 *
 * Clearing a whole set is the exception: it is taken with nothing open, and it is the move that empties a queue
 * narrowed to the unread, so that one is read back rather than left saying it still holds what was just cleared.
 *
 * @returns The marks as described by {@link UseDefenseReviewReadStateResult}.
 */
export function useDefenseReviewReadState(): UseDefenseReviewReadStateResult {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // The cache the rows live in
  const queryClient = useQueryClient()

  // The marks still settling, per conversation. A second mark on one reads a row the first has already
  // rewritten, so the snapshot the first took is the one they all roll back to, and it outlives each of them.
  const inFlight = useRef(new Map<string, ReadStateMarks>())

  // The write itself, which rewrites the row first and puts it back if the write fails
  const { mutate } = useOptimisticMutation<void, ReadStateChange, ReadStateSnapshot | null>({
    apiFn: sendReadStateChange,
    // Marks on one conversation all write the same row, so they run one at a time rather than racing: two
    // clicks landing out of order would leave the server holding the earlier one and nothing on screen saying so
    scope: { id: 'defense-review-read-state' },
    onMutate: ({ sessionId, mark }) => {
      // Whatever is already settling on this conversation, whose snapshot predates all of it
      const existing = inFlight.current.get(sessionId)

      // This mark joins them, or opens the set
      const marks = existing ?? { previous: null, outstanding: 0 }

      // One more mark to settle before the row is nobody's business
      marks.outstanding += 1

      // Held under the conversation it is settling on
      inFlight.current.set(sessionId, marks)

      // What this mark writes, held so that landing it can make it the state a later failure falls back to
      const written: WrittenReadState = { value: null }

      // Rewrite it to what the reader has already seen happen
      patchCachedQueueConversation(queryClient, sessionId, (conversation) => {
        // Only the mark that opened the set sees the row as the server last left it, and only off one copy
        // of it: the conversation is cached once per filtering and language, and copies read at different
        // moments disagree about how much of it is unread
        if (existing === undefined && marks.previous === null) {
          // What the row said before any mark touched it
          marks.previous = {
            readAt: conversation.readAt,
            unreadTurnCount: conversation.unreadTurnCount,
          }
        }

        // What the mark leaves the row saying, computed once so every copy of it says the same thing
        written.value ??= markedReadState(conversation, mark, new Date().toISOString())

        // The row as this mark leaves it
        return { ...conversation, ...written.value }
      })

      // Handed on so this mark's own write is recoverable once it lands
      return written.value
    },
    onSuccess: (_data, { sessionId }, written) => {
      // What this mark was settling alongside
      const marks = inFlight.current.get(sessionId)

      // Nothing to move on if the row was never on screen
      if (marks?.previous == null || written == null) return

      // This mark is on the server now, so it and not the state before the set is what a mark failing behind
      // it has to put back: rolling past a committed write leaves the row saying the opposite of the truth
      marks.previous = written

      // Nothing behind it is left to decide what the row says, so it says what actually landed. Which the
      // rewrite on the way out already wrote, except where a mark refused since then skipped its own rollback
      // or a read of the whole queue landed over it.
      if (marks.outstanding === 1) {
        patchCachedQueueConversation(queryClient, sessionId, (conversation) => ({
          ...conversation,
          ...written,
        }))
      }
    },
    onError: (_error, { sessionId }) => {
      // What the row said before any of the marks still settling touched it
      const marks = inFlight.current.get(sessionId)

      // Nothing to put back if the row was never on screen
      if (marks?.previous == null) return

      // A mark behind this one settles later and decides what the row ends up saying
      if (marks.outstanding > 1) return

      // Put the row back the way it was
      patchCachedQueueConversation(queryClient, sessionId, (conversation) => ({
        ...conversation,
        ...marks.previous,
      }))
    },
    onSettled: (_data, _error, { sessionId }) => {
      // What this mark was settling alongside
      const marks = inFlight.current.get(sessionId)

      // Nothing to settle if the row was never on screen
      if (marks === undefined) return

      // One fewer outstanding
      marks.outstanding -= 1

      // The snapshot goes with the last of them, since there is no longer anything to put back
      if (marks.outstanding === 0) inFlight.current.delete(sessionId)
    },
    authReason: t('readStateFailed'),
    errorMessage: t('readStateFailed'),
  })

  // Marking a whole set, which the queue offers as one move and so sends as one request. Its own mutation
  // rather than a loop over the single one: the endpoints here are rate limited per caller, so a backlog spent
  // one conversation at a time is a burst the limiter turns down partway through.
  const { mutate: mutateMany } = useOptimisticMutation<
    void,
    BulkReadStateChange,
    Map<string, ReadStateSnapshot>
  >({
    apiFn: (apiCall, { sessionIds, read }) => setDefenseReviewReadStates(apiCall, sessionIds, read),
    onMutate: ({ sessionIds, read }) => {
      // What the rows said before the set was touched, which is what a failure puts back
      const previous = new Map<string, ReadStateSnapshot>()

      // The moment the whole set is read as of, so it reads as one pass rather than a spread of stamps
      const readAt = new Date().toISOString()

      // Rewrite every one of them in a single sweep of the cache
      patchCachedQueueConversations(queryClient, sessionIds, (conversation) => {
        // What this row said before
        previous.set(conversation.id, {
          readAt: conversation.readAt,
          unreadTurnCount: conversation.unreadTurnCount,
        })

        // The row as the set's own mark leaves it, under the one moment they share
        return {
          ...conversation,
          ...markedReadState(conversation, { kind: read ? 'read' : 'unread' }, readAt),
        }
      })

      // Handed on so a failure has the whole set to put back
      return previous
    },
    onSuccess: () => {
      // A queue narrowed to the unread was built out of rows the set just cleared, and no rewrite of a row can
      // take it off a page. Read back once the server holds the marks, so the pages can't come back saying what
      // the marks have already undone.
      invalidateUnreadQueue(queryClient)
    },
    onError: (_error, _variables, previous) => {
      // Nothing to put back if no row was on screen
      if (previous === undefined || previous.size === 0) return

      // Put every row back the way it was, in one sweep again
      patchCachedQueueConversations(queryClient, [...previous.keys()], (conversation) => ({
        ...conversation,
        ...previous.get(conversation.id),
      }))
    },
    authReason: t('readStateFailed'),
    errorMessage: t('readStateFailed'),
  })

  // Stamps a conversation as read
  const markRead = useCallback(
    (sessionId: string) => mutate({ sessionId, mark: { kind: 'read' } }),
    [mutate]
  )

  // Leaves a conversation unread
  const markUnread = useCallback(
    (sessionId: string) => mutate({ sessionId, mark: { kind: 'unread' } }),
    [mutate]
  )

  // Picks a conversation up again from one of its turns. The refusal goes back to the caller as well as to the
  // row, since the open conversation holds a mark of its own that the row's rollback doesn't reach.
  const markUnreadFrom = useCallback(
    (sessionId: string, turnId: string, boundary: ReadPassBoundary, onRefused: () => void) =>
      mutate(
        { sessionId, mark: { kind: 'unreadFromTurn', turnId, boundary } },
        { onError: onRefused }
      ),
    [mutate]
  )

  // Marks a whole set at once
  const markMany = useCallback(
    (sessionIds: readonly string[], read: boolean) => mutateMany({ sessionIds, read }),
    [mutateMany]
  )

  // The marks, each landing on screen before it lands on the server
  return { markRead, markUnread, markUnreadFrom, markMany }
}
