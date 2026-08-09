import { skipToken, useQuery } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { unwrap } from '@/lib/api/api-error'
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
  // The authenticated caller
  const api = useApi({ requireAuth: true })

  // The conversation itself. The fetcher closes over the id the key was built from rather than reading the
  // argument back, so it can't be reached with none open and needs no assertion that it wasn't.
  const query = useQuery({
    queryKey: reviewDetailQueryKey(sessionId ?? NO_CONVERSATION),
    queryFn:
      sessionId === null
        ? skipToken
        : async ({ signal }) =>
            unwrap(await fetchDefenseReviewDetail(readyApiCall(api), sessionId, signal)),
    ...cachePolicy.userData,
    enabled: api.state === 'ready',
  })

  // The conversation once it has arrived, and how the fetch is going meanwhile
  return { detail: query.data ?? null, uiState: useQueryUiState(query) }
}
