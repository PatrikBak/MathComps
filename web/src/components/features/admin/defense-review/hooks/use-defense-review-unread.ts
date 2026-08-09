'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import type { DefenseReviewConversation } from '../model/defense-review-types'

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
  // Anything carrying a turn nobody has read
  return new Set(
    conversations
      .filter((conversation) => conversation.unreadTurnCount > 0)
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
 * @param conversations - The conversations loaded so far.
 * @param markMany - Marks a whole set of conversations at once.
 *
 * @returns The unread conversations as described by {@link UseDefenseReviewUnreadResult}.
 */
export function useDefenseReviewUnread(
  conversations: DefenseReviewConversation[],
  markMany: (sessionIds: readonly string[], read: boolean) => void
): UseDefenseReviewUnreadResult {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

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
    markMany(sessionIds, true)

    // Say how many it took
    toast.success(t('markedRead', { count: sessionIds.length }))
  }, [unreadConversationIds, markMany, t])

  // What is unread, and the way to be done with all of it
  return { unreadConversationIds, markLoadedRead }
}
