import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { GradingBoard } from '../model/grading-types'
import { getGradingBoardUrl } from './grading-api-urls'

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
