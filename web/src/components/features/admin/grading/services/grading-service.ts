import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { Grade, GradeChange, GradeDetail, GradingBoard } from '../model/grading-types'
import { getGradeUrl, getGradingBoardUrl } from './grading-api-urls'

/**
 * Reads everything grading one group starts from.
 *
 * @param apiCall - The authenticated API caller.
 * @param groupSlug - What addresses the group.
 * @returns The group's name and dates, and each of its competitions with every entrant on every problem.
 */
export function fetchGradingBoard(
  apiCall: ApiCaller,
  groupSlug: string
): Promise<ApiResult<GradingBoard>> {
  return apiCall<GradingBoard>(() => getGradingBoardUrl(groupSlug))
}

/**
 * Reads everything one entrant's grade on one problem is read from.
 *
 * @param apiCall - The authenticated API caller.
 * @param problemId - The problem.
 * @param userId - The entrant.
 * @returns Their conversations about it and what they said about their solution.
 */
export function fetchGradeDetail(
  apiCall: ApiCaller,
  problemId: string,
  userId: string
): Promise<ApiResult<GradeDetail>> {
  return apiCall<GradeDetail>(() => getGradeUrl(problemId, userId))
}

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
