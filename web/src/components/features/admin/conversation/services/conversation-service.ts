import type { DefenseSessionTarget } from '@/components/features/defense/model/defense-types'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { AdminConversation, StudentConversations } from '../model/admin-conversation'
import {
  getConversationDetailUrl,
  getConversationReadStateUrl,
  getConversationUnreadFromUrl,
  getStudentConversationsUrl,
} from './conversation-api-urls'

/**
 * The backend for reading defense conversations back as an admin: authenticated calls to the .NET API, every one
 * of them behind the admin policy.
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
): Promise<ApiResult<AdminConversation>> {
  return apiCall<AdminConversation>(() => getConversationDetailUrl(sessionId))
}

/**
 * Reads every conversation one student held about one problem, and where their grade on it stands.
 *
 * @param apiCall - The authenticated API caller.
 * @param userId - The student.
 * @param target - The problem.
 * @returns The conversations, oldest first, and the grading when the student's entry is graded.
 */
export function fetchStudentConversations(
  apiCall: ApiCaller,
  userId: string,
  target: DefenseSessionTarget
): Promise<ApiResult<StudentConversations>> {
  return apiCall<StudentConversations>(() => getStudentConversationsUrl(userId, target))
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
