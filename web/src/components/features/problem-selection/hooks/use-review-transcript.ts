'use client'

import { useApiQuery } from '@/hooks/use-api-query'
import { BackendApiError } from '@/lib/api/api-error'
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
    fetch: (apiCall) => {
      // The gate below keeps this from running with nothing open, so reaching here is a bug
      if (conversationId === null) {
        throw new BackendApiError({ message: 'No conversation is open', errorCode: 'SERVER_ERROR' })
      }

      // The statement and the turns
      return getTranscript(apiCall, conversationId)
    },
    // The selection is never public, so neither is anything said about its problems
    requireAuth: true,
    // Nothing is read while no conversation is open
    enabled: conversationId !== null,
    // A conversation can still be going on, so a copy counts as fresh only briefly
    ...cachePolicy.userData,
  })

  // The transcript once it has arrived, and how the read is going meanwhile
  return { transcript: transcript ?? null, uiState }
}
