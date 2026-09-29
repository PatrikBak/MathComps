import { buildApiUrl } from '@/components/shared/utils/url-utils'

import { ADMIN_DEFENSE_PATH } from '../../conversation/services/conversation-api-urls'

/**
 * Builds the URL for reading a page of the review queue.
 *
 * @returns The queue URL.
 */
export function getDefenseReviewQueueUrl(): string {
  // The filter endpoint, which takes its many filters in a body rather than a query string
  return buildApiUrl(`${ADMIN_DEFENSE_PATH}/sessions/filter`)
}

/**
 * Builds the URL for reading what the queue's filters can be set to.
 *
 * @returns The filter-options URL.
 */
export function getDefenseReviewFilterOptionsUrl(): string {
  // The options endpoint, which hands back all three lists at once
  return buildApiUrl(`${ADMIN_DEFENSE_PATH}/filters`)
}

/**
 * Builds the URL for marking a whole set of conversations at once.
 *
 * @returns The bulk mark URL.
 */
export function getConversationsReadStateUrl(): string {
  // The set endpoint, which names its conversations in a body rather than in the path
  return buildApiUrl(`${ADMIN_DEFENSE_PATH}/sessions/review`)
}
