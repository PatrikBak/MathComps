import type { DefenseSessionTarget } from '@/components/features/defense/model/defense-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the admin endpoints over defense conversations.
 */
export const ADMIN_DEFENSE_PATH = '/admin/defense'

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
