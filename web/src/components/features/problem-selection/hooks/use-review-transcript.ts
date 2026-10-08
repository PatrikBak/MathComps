'use client'

import { skipToken } from '@tanstack/react-query'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { ReviewTranscript } from '../model/selection-types'
import { getTranscript } from '../services/selection-service'
import { useTranscriptQueryKey } from './selection-cache'

/**
 * What {@link useReviewTranscript} hands back.
 */
type UseReviewTranscriptResult = {
  /** Everything said in the conversation; null until it has been read. */
  transcript: ReviewTranscript | null
  /** How far the read has got. */
  uiState: QueryUiState
}

/**
 * Reads everything said in one conversation about a problem, once somebody opens it. The selection lists the
 * conversations without what was said in them.
 *
 * @param conversationId - The conversation, or null while none is open.
 *
 * @returns The transcript and how far its read has got.
 */
export function useReviewTranscript(conversationId: string | null): UseReviewTranscriptResult {
  // Where the conversation is cached for the reader
  const queryKey = useTranscriptQueryKey(conversationId)

  // The transcript itself
  const { data: transcript, uiState } = useApiQuery<ReviewTranscript>({
    queryKey,
    // Nothing while no conversation is open, then the statement and the turns
    fetch:
      conversationId === null ? skipToken : (apiCall) => getTranscript(apiCall, conversationId),
    // The selection is never public, so neither is anything said about its problems
    requireAuth: true,
    // A conversation can still be going on, so a copy counts as fresh only briefly
    ...cachePolicy.userData,
  })

  // The transcript once it has arrived, and how the read is going meanwhile
  return { transcript: transcript ?? null, uiState }
}
