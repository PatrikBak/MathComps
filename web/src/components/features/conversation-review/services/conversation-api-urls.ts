import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the endpoints reviewing one defense conversation.
 */
export const CONVERSATION_REVIEW_PATH = '/admin/defense'

/**
 * Builds the URL for reading one conversation in full.
 *
 * @param sessionId - The conversation to read.
 * @returns The conversation's URL.
 */
export function getConversationDetailUrl(sessionId: string): string {
  // The conversation's own endpoint
  return buildApiUrl(`${CONVERSATION_REVIEW_PATH}/sessions/${encodeURIComponent(sessionId)}`)
}

/**
 * Builds the URL for a conversation's read stamp.
 *
 * @param sessionId - The conversation whose read stamp it is.
 * @returns The read stamp's URL.
 */
export function getConversationReadStateUrl(sessionId: string): string {
  // The conversation's own review endpoint, written to mark it read and dropped to mark it unread
  return buildApiUrl(`${CONVERSATION_REVIEW_PATH}/sessions/${encodeURIComponent(sessionId)}/review`)
}

/**
 * Builds the URL for where a reader picks a conversation up again.
 *
 * @param sessionId - The conversation to pick up again.
 * @param turnId - The turn to leave unread, along with every turn after it.
 * @returns The URL for moving the conversation's read stamp back to just before that turn.
 */
export function getConversationUnreadFromUrl(sessionId: string, turnId: string): string {
  // The conversation's own review endpoint, narrowed to the turn the reading picks up from
  const path = `${CONVERSATION_REVIEW_PATH}/sessions/${encodeURIComponent(sessionId)}/review/from`

  // Under the turn itself
  return buildApiUrl(`${path}/${encodeURIComponent(turnId)}`)
}
