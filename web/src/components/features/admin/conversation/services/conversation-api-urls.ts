import type { DefenseSessionTarget } from '@/components/features/defense/model/defense-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the admin endpoints over defense conversations.
 */
export const ADMIN_DEFENSE_PATH = '/admin/defense'

/**
 * Builds the URL for reading one conversation in full.
 *
 * @param sessionId - The conversation to read.
 * @returns The conversation's URL.
 */
export function getConversationDetailUrl(sessionId: string): string {
  // The conversation's own endpoint
  return buildApiUrl(`${ADMIN_DEFENSE_PATH}/sessions/${encodeURIComponent(sessionId)}`)
}

/**
 * Builds the URL for listing one student's conversations about one problem.
 *
 * @param userId - The student.
 * @param target - The problem.
 * @returns The list's URL.
 */
export function getStudentConversationsUrl(userId: string, target: DefenseSessionTarget): string {
  // Every conversation the student holds
  const path = `${ADMIN_DEFENSE_PATH}/students/${encodeURIComponent(userId)}/sessions`

  // Narrowed to the problem, which each kind names its own way
  switch (target.kind) {
    // A handout environment, named by both of its content ids in the query
    case 'handout':
      return buildApiUrl(path, {
        handoutContentId: target.handoutContentId,
        environmentId: target.environmentId,
      })

    // An archive problem, which its own id addresses
    case 'problem':
      return buildApiUrl(`${path}/problems/${encodeURIComponent(target.problemId)}`)

    // A target nothing here knows
    default:
      return assertNever(target)
  }
}

/**
 * Builds the URL for a conversation's read stamp.
 *
 * @param sessionId - The conversation whose read stamp it is.
 * @returns The read stamp's URL.
 */
export function getConversationReadStateUrl(sessionId: string): string {
  // The conversation's own review endpoint, written to mark it read and dropped to mark it unread
  return buildApiUrl(`${ADMIN_DEFENSE_PATH}/sessions/${encodeURIComponent(sessionId)}/review`)
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
  const path = `${ADMIN_DEFENSE_PATH}/sessions/${encodeURIComponent(sessionId)}/review/from`

  // Under the turn itself
  return buildApiUrl(`${path}/${encodeURIComponent(turnId)}`)
}
