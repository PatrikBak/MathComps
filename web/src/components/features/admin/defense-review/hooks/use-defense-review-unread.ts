'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import { patchCachedQueueConversations } from '../../conversation/hooks/conversation-cache'
import {
  markedReadState,
  type ReadStateSnapshot,
} from '../../conversation/hooks/use-conversation-read-state'
import type { DefenseReviewConversation } from '../model/defense-review-types'
import { setConversationsRead } from '../services/defense-review-service'
import { invalidateUnreadQueue } from './defense-review-cache'

/**
 * Picks out the conversations something has arrived in since they were last read.
 *
 * @param conversations - The conversations loaded so far.
 *
 * @returns The ids of the unread ones.
 */
function toUnreadConversationIds(
  conversations: readonly DefenseReviewConversation[]
): ReadonlySet<string> {
  // Anything carrying something nobody has read
  return new Set(
    conversations
      .filter((conversation) => conversation.isUnread)
      .map((conversation) => conversation.id)
  )
}

/**
 * What {@link useDefenseReviewUnread} hands back.
 */
type UseDefenseReviewUnreadResult = {
  /** Which of the loaded conversations something has arrived in since they were last read. */
  unreadConversationIds: ReadonlySet<string>
  /** Clears every one of them at once. */
  markLoadedRead: () => void
}

/**
 * Which of the loaded conversations are still unread, and clearing the lot of them.
 *
 * Clearing them wholesale is what saves a first pass over a full queue from meaning opening every conversation
 * just to empty the unread filter. It is the only move on this surface that changes several at once, so it
 * says how many it took. Taking it back is per conversation: a stamp records only that a conversation was
 * read, so putting a set back to unread would forget where each of their last passes stopped.
 *
 * The rows are rewritten at once, and a queue narrowed to the unread is read back once the server holds the
 * marks, since clearing is the move that empties it.
 *
 * @param conversations - The conversations loaded so far.
 *
 * @returns The unread conversations as described by {@link UseDefenseReviewUnreadResult}.
 */
export function useDefenseReviewUnread(
  conversations: DefenseReviewConversation[]
): UseDefenseReviewUnreadResult {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Shared conversation-dialog copy
  const tConversation = useTranslations('admin.conversation')

  // The cache the rows live in
  const queryClient = useQueryClient()

  // Marking a whole set, sent as one request
  const { mutate: markManyRead } = useOptimisticMutation<
    void,
    readonly string[],
    Map<string, ReadStateSnapshot>
  >({
    apiFn: setConversationsRead,
    onMutate: (sessionIds) => {
      // What the rows said before the set was touched, which is what a failure puts back
      const previous = new Map<string, ReadStateSnapshot>()

      // The moment the whole set is read as of, so it reads as one pass rather than a spread of stamps
      const readAt = new Date().toISOString()

      // Rewrite every conversation of the set in a single sweep of the cache
      patchCachedQueueConversations(queryClient, sessionIds, (conversation) => {
        // What this row said before
        previous.set(conversation.id, {
          readAt: conversation.readAt,
          isUnread: conversation.isUnread,
          unreadStudentMessageCount: conversation.unreadStudentMessageCount,
        })

        // The row as the set's own mark leaves it, under the one moment they share
        return { ...conversation, ...markedReadState(conversation, { kind: 'read' }, readAt) }
      })

      // Handed on so a failure has the whole set to put back
      return previous
    },
    // Read back once the server holds the marks, so the pages can't come back saying what the marks have undone
    onSuccess: () => invalidateUnreadQueue(queryClient),
    onError: (_error, _variables, previous) => {
      // Nothing to put back if no row was on screen
      if (previous === undefined || previous.size === 0) return

      // Put every row back the way it was, in one sweep again
      patchCachedQueueConversations(queryClient, [...previous.keys()], (conversation) => ({
        ...conversation,
        ...previous.get(conversation.id),
      }))
    },
    authReason: tConversation('readStateFailed'),
    errorMessage: tConversation('readStateFailed'),
  })

  // Which of them are still unread
  const unreadConversationIds = useMemo(
    () => toUnreadConversationIds(conversations),
    [conversations]
  )

  // Clears everything loaded so far in one go
  const markLoadedRead = useCallback(() => {
    // The conversations it clears
    const sessionIds = [...unreadConversationIds]

    // Stamp the lot of them
    markManyRead(sessionIds)

    // Say how many it took
    toast.success(t('markedRead', { count: sessionIds.length }))
  }, [unreadConversationIds, markManyRead, t])

  // What is unread, and the way to be done with all of it
  return { unreadConversationIds, markLoadedRead }
}
