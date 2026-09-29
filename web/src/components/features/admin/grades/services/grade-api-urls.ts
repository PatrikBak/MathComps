import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the grading endpoints.
 */
export const GRADING_PATH = '/admin/grading'

/**
 * Builds the URL of one entrant's grade on one problem.
 *
 * @param problemId - The problem.
 * @param userId - The entrant.
 * @returns The grade's URL.
 */
export function getGradeUrl(problemId: string, userId: string): string {
  // The problem first, then the entrant graded on it
  return buildApiUrl(
    `${GRADING_PATH}/problems/${encodeURIComponent(problemId)}/students/${encodeURIComponent(userId)}`
  )
}
