import { buildApiUrl } from '@/components/shared/utils/url-utils'

import { GRADING_PATH } from '../../grades/services/grade-api-urls'

/**
 * Builds the URL for reading everything grading one group starts from.
 *
 * @param groupSlug - What addresses the group.
 * @returns The board URL.
 */
export function getGradingBoardUrl(groupSlug: string): string {
  // The group's own board
  return buildApiUrl(`${GRADING_PATH}/groups/${encodeURIComponent(groupSlug)}`)
}
