import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { ConversationDetail } from '../model/conversation-detail'
import {
  getConversationDetailUrl,
  getConversationReadStateUrl,
  getConversationUnreadFromUrl,
} from './conversation-api-urls'

/**
 * The backend for reviewing one defense conversation: authenticated calls to the .NET API, open to admins for every
 * conversation and to the problem selection's reviewers for the conversations held about the proposals.
 */

/**
 * Reads one conversation in full, along with the read stamp as it stood before this read.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The conversation to read.
 * @returns The whole conversation.
 */
export function fetchConversationDetail(
  apiCall: ApiCaller,
  sessionId: string
): Promise<ApiResult<ConversationDetail>> {
  return apiCall<ConversationDetail>(() => getConversationDetailUrl(sessionId))
}

/**
 * Records that a conversation has been read as of now, or takes that record back.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The conversation.
 * @param read - True to stamp it as read, false to leave it unread.
 * @returns Nothing on success.
 */
export function setConversationReadState(
  apiCall: ApiCaller,
  sessionId: string,
  read: boolean
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getConversationReadStateUrl(sessionId), {
    method: read ? 'PUT' : 'DELETE',
  })
}

/**
 * Moves where a reader picks a conversation up back to just before one of its turns, leaving that turn and
 * everything after it to be read again.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The conversation.
 * @param turnId - The turn to leave unread, along with every turn after it.
 * @returns Nothing on success.
 */
export function setConversationUnreadFromTurn(
  apiCall: ApiCaller,
  sessionId: string,
  turnId: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getConversationUnreadFromUrl(sessionId, turnId), { method: 'PUT' })
}
