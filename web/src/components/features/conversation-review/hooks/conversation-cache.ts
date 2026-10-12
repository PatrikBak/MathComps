import type { QueryClient, QueryKey } from '@tanstack/react-query'

/** The root every query about reviewing a defense conversation hangs off. */
const CONVERSATION_REVIEW_QUERY_KEY = ['conversationReview'] as const

/**
 * The key every reading of one conversation hangs off.
 *
 * {@link conversationDetailQueryKey} adds the reader and the language, and whatever refreshes or drops one conversation
 * for every reader in every language matches on this much alone, so all of them follow whatever this says.
 *
 * @param sessionId - The conversation.
 * @returns The key.
 */
export function conversationDetailKeyPrefix(sessionId: string): QueryKey {
  // One conversation, whoever reads it in whichever language
  return [...CONVERSATION_REVIEW_QUERY_KEY, 'detail', sessionId] as const
}

/**
 * Builds the query key for one conversation read in full. It names the reader, since the read stamp and which notes
 * are theirs come back with it, and the token rides in a header the cache never sees.
 *
 * @param sessionId - The conversation.
 * @param readerId - Who reads it; null until sign-in has settled or while nobody is signed in.
 * @param locale - The language it is read in.
 * @returns The query key.
 */
export function conversationDetailQueryKey(
  sessionId: string,
  readerId: string | null,
  locale: string
): QueryKey {
  // The reader and the language after the prefix, so it still reaches the conversation for every reader in every
  // language
  return [...conversationDetailKeyPrefix(sessionId), readerId, locale] as const
}

/**
 * Refreshes one conversation wherever it is cached, in every language it has been read in. What a note says
 * about a conversation is true of the conversation rather than of the reading, so a copy left holding the note
 * list from before the write would go on offering a settled note as still standing.
 *
 * @param queryClient - The cache to refresh.
 * @param sessionId - The conversation.
 */
export function invalidateConversationDetail(queryClient: QueryClient, sessionId: string): void {
  // That one conversation, whoever read it in whichever language
  void queryClient.invalidateQueries({ queryKey: conversationDetailKeyPrefix(sessionId) })
}
