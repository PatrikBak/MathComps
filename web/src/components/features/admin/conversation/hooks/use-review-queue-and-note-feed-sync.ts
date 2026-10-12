import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { ConversationListSync } from '@/components/features/conversation-review/model/conversation-list-sync'

import { invalidateNoteFeed } from '../../notes/hooks/note-cache'
import { patchCachedQueueConversation } from './conversation-cache'

/**
 * The {@link ConversationListSync} over the review queue and the notes feed. The queue's rows are patched in
 * place, for the reason {@link patchCachedQueueConversation} gives, and the feed is read back, for the reason
 * {@link invalidateNoteFeed} gives.
 *
 * @returns The lists as described by {@link ConversationListSync}.
 */
export function useReviewQueueAndNoteFeedSync(): ConversationListSync {
  // The cache the queue and the feed live in
  const queryClient = useQueryClient()

  // A function which rewrites what a conversation's row in the queue says about having been read
  const patchReadState = useCallback<ConversationListSync['patchReadState']>(
    (sessionId, rewrite) =>
      patchCachedQueueConversation(queryClient, sessionId, (conversation) => ({
        ...conversation,
        ...rewrite(conversation),
      })),
    [queryClient]
  )

  // A function which takes in a write that landed against a conversation's notes
  const noteWritten = useCallback<ConversationListSync['noteWritten']>(
    (sessionId, countDelta) => {
      // Read the feed back, whatever the write did
      invalidateNoteFeed(queryClient)

      // Only a write that moves the count reaches the row
      if (countDelta === 0) return

      // The row's count, moved by what the write added or took away
      patchCachedQueueConversation(queryClient, sessionId, (conversation) => ({
        ...conversation,
        noteCount: conversation.noteCount + countDelta,
      }))
    },
    [queryClient]
  )

  // The queue and the feed, kept in step
  return { patchReadState, noteWritten }
}
