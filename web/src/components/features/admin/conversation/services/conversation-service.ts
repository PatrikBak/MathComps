import type { DefenseSessionTarget } from '@/components/features/defense/model/defense-types'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { StudentConversations } from '../model/student-conversations'
import { getStudentConversationsUrl } from './conversation-api-urls'

/**
 * The backend for an admin's lists of defense conversations: authenticated calls to the .NET API, open to admins
 * alone.
 */

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
