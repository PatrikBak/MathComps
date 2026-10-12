import { buildApiUrl } from '@/components/shared/utils/url-utils'

import { ADMIN_DEFENSE_PATH } from '../../conversation/services/conversation-api-urls'

/**
 * The path the notes feed is read from.
 */
const FEED_PATH = `${ADMIN_DEFENSE_PATH}/notes`

/**
 * Builds the URL for reading notes across every conversation.
 *
 * @param openOnly - Whether to leave out the notes already settled.
 * @param pageNumber - 1-based page index to retrieve.
 * @returns The feed URL.
 */
export function getAdminNoteFeedUrl(openOnly: boolean, pageNumber: number): string {
  // The feed endpoint, narrowed and paged
  return buildApiUrl(FEED_PATH, {
    openOnly: String(openOnly),
    pageNumber: String(pageNumber),
  })
}
