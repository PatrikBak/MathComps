import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { Grade, GradeChange, StudentGrade } from '../model/grade-types'
import { getGradeUrl, getProblemFinalUrl } from './grade-api-urls'

/**
 * Changes one entrant's grade on one problem.
 *
 * @param apiCall - The authenticated API caller.
 * @param problemId - The problem.
 * @param userId - The entrant.
 * @param change - What changed, and nothing else.
 * @returns The grade as it now stands; null while there still is none.
 */
export async function updateGrade(
  apiCall: ApiCaller,
  problemId: string,
  userId: string,
  change: GradeChange
): Promise<ApiResult<Grade | null>> {
  // The change, sent as it is
  const result = await apiCall<Grade | Record<never, never>>(() => getGradeUrl(problemId, userId), {
    method: 'PATCH',
    body: JSON.stringify(change),
  })

  // A failure, as it came
  if (!result.success) return result

  // The grade, which always carries when it last changed, or null for the empty answer of a student still ungraded
  return { success: true, data: 'updatedAt' in result.data ? result.data : null }
}

/**
 * Makes final every grade on one problem among the entrants named that carries a mark and is not final yet.
 *
 * @param apiCall - The authenticated API caller.
 * @param problemId - The problem.
 * @param userIds - The entrants.
 * @returns The grade each of them now holds on the problem, leaving out those holding none.
 */
export function finalizeGrades(
  apiCall: ApiCaller,
  problemId: string,
  userIds: string[]
): Promise<ApiResult<StudentGrade[]>> {
  // The entrants, in the body
  return apiCall<StudentGrade[]>(() => getProblemFinalUrl(problemId), {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  })
}
