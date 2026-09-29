import type { ApiCaller } from '@/hooks/use-api'
import type { PagedList } from '@/lib/api/paged-list'
import type { ApiResult } from '@/types/api'

import type {
  DefenseReviewConversation,
  DefenseReviewFilter,
  DefenseReviewFilterOptions,
} from '../model/defense-review-types'
import {
  getConversationsReadStateUrl,
  getDefenseReviewFilterOptionsUrl,
  getDefenseReviewQueueUrl,
} from './defense-review-api-urls'

/**
 * The backend for the review queue: authenticated calls to the .NET API, every one of them behind the admin
 * policy.
 */

/**
 * Reads one page of the review queue, the conversations spoken to most recently first.
 *
 * @param apiCall - The authenticated API caller.
 * @param filter - Which conversations to show.
 * @param pageNumber - 1-based page index to retrieve.
 * @returns The page of conversations.
 */
export function fetchDefenseReviewQueue(
  apiCall: ApiCaller,
  filter: DefenseReviewFilter,
  pageNumber: number
): Promise<ApiResult<PagedList<DefenseReviewConversation>>> {
  return apiCall<PagedList<DefenseReviewConversation>>(() => getDefenseReviewQueueUrl(), {
    method: 'POST',
    body: JSON.stringify({ filter, pageNumber }),
  })
}

/**
 * Reads what the queue's filters can be set to.
 *
 * @param apiCall - The authenticated API caller.
 * @returns Every student, problem, and set of examiner settings a conversation exists under.
 */
export function fetchDefenseReviewFilterOptions(
  apiCall: ApiCaller
): Promise<ApiResult<DefenseReviewFilterOptions>> {
  return apiCall<DefenseReviewFilterOptions>(() => getDefenseReviewFilterOptionsUrl())
}

/**
 * Stamps a whole set of conversations as read as of now.
 *
 * One request rather than one per conversation: the endpoints behind this surface are rate limited per caller,
 * and a queue scrolled through a backlog holds more conversations than one limiter window allows.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionIds - The conversations to mark.
 * @returns Nothing on success.
 */
export function setConversationsRead(
  apiCall: ApiCaller,
  sessionIds: readonly string[]
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getConversationsReadStateUrl(), {
    method: 'PUT',
    body: JSON.stringify({ sessionIds }),
  })
}
