import { useLocale } from 'next-intl'

import { useApiQuery } from '@/hooks/use-api-query'
import { BackendApiError } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { DefenseReviewDetail } from '../model/defense-review-types'
import { fetchDefenseReviewDetail } from '../services/defense-review-service'
import { reviewDetailQueryKey } from './defense-review-cache'

/**
 * Stands in for the conversation's id while none is open, so the idle cache entry is named rather than blank.
 */
const NO_CONVERSATION = 'none'

/**
 * What {@link useDefenseReviewDetail} hands back.
 */
type UseDefenseReviewDetailResult = {
  /** The whole conversation; null until it has been read. */
  detail: DefenseReviewDetail | null
  /** The state of the fetch. */
  uiState: QueryUiState
}

/**
 * Reads one conversation in full.
 *
 * Kept apart from the conversation's notes so that writing one doesn't drag a whole transcript and its
 * settings snapshot back over the wire.
 *
 * @param sessionId - The conversation to read, or null while none is open.
 * @returns The conversation as described by {@link UseDefenseReviewDetailResult}.
 */
export function useDefenseReviewDetail(sessionId: string | null): UseDefenseReviewDetailResult {
  // The language it is read in
  const locale = useLocale()

  // The conversation itself
  const { data: detail, uiState } = useApiQuery({
    queryKey: reviewDetailQueryKey(sessionId ?? NO_CONVERSATION, locale),
    fetch: (apiCall) => {
      // The gate below keeps this from running with nothing open, so reaching here is a bug
      if (sessionId === null) {
        throw new BackendApiError({ message: 'No conversation is open', errorCode: 'SERVER_ERROR' })
      }

      // The transcript and everything read alongside it
      return fetchDefenseReviewDetail(apiCall, sessionId)
    },
    // The transcript is an admin's own read, so it is made as them
    requireAuth: true,
    // Nothing is read while no conversation is open
    enabled: sessionId !== null,
    ...cachePolicy.userData,
  })

  // The conversation once it has arrived, and how the fetch is going meanwhile
  return { detail: detail ?? null, uiState }
}
