'use client'

import { useAuth } from '@clerk/nextjs'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * The prefix every cached copy of the selection sits under, whoever it was read as.
 */
const SELECTION_QUERY_KEY = ['problem-selection'] as const

/**
 * The key the reader's selection is cached under. It names the reader because the read is theirs: the token
 * rides in a header the cache never sees, and another account signing in on the same page must not be handed
 * the first one's answer.
 *
 * @returns The key, naming nobody until sign-in has settled who the reader is.
 */
export function useSelectionQueryKey(): QueryKey {
  // Who is reading, once sign-in has settled
  const { userId, isLoaded } = useAuth()

  // The selection, per reader, naming nobody until sign-in has settled or while nobody is signed in
  return [...SELECTION_QUERY_KEY, isLoaded ? (userId ?? null) : null] as const
}

/**
 * The prefix every cached transcript sits under, kept apart from the selection's so refreshing the selection
 * leaves a conversation being read alone.
 */
const TRANSCRIPT_QUERY_KEY = ['problem-selection-transcript'] as const

/**
 * The key one conversation's transcript is cached under, naming the reader for the reason
 * {@link useSelectionQueryKey} gives.
 *
 * @param conversationId - The conversation; null while none is open.
 *
 * @returns The key.
 */
export function useTranscriptQueryKey(conversationId: string | null): QueryKey {
  // Who is reading, once sign-in has settled
  const { userId, isLoaded } = useAuth()

  // The conversation, per reader, naming nobody until sign-in has settled or while nobody is signed in
  return [...TRANSCRIPT_QUERY_KEY, isLoaded ? (userId ?? null) : null, conversationId] as const
}

/**
 * Refreshes every cached copy of the selection, whoever it was read as.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateSelection(queryClient: QueryClient): void {
  // Every copy under the shared prefix, whichever reader its key names
  void queryClient.invalidateQueries({ queryKey: SELECTION_QUERY_KEY })
}
