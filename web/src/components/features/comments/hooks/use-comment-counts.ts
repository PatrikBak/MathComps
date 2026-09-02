import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import { isAwaitingAnswer } from '@/lib/query-ui-state'
import type { ApiResult } from '@/types/api'

import type { CommentTargetType } from '../services/comment-api-types'
import { getCommentCounts } from '../services/comment-service'
import { commentCountQueryKeys } from './comment-query-keys'

/**
 * How many comments each of a set of targets carries.
 */
type CommentCounts = Record<string, number>

/**
 * What {@link useCommentCounts} hands back.
 */
type UseCommentCountsResult = {
  /** How many comments each target carries, keyed by target id; empty until the read lands. */
  counts: CommentCounts
  /** Whether a count may still be coming, which is what a badge waits on. */
  isLoading: boolean
}

/**
 * Reads the comment count for a set of targets of one type in a single call.
 *
 * @param targetType - What kind of thing the targets are.
 * @param targetIds - The targets to count for.
 *
 * @returns The counts and whether they may still be coming.
 */
export function useCommentCounts(
  targetType: CommentTargetType,
  targetIds: string[]
): UseCommentCountsResult {
  // The counts themselves
  const { data: counts, uiState } = useApiQuery({
    queryKey: commentCountQueryKeys.forTargetIds(targetType, targetIds),
    fetch: (apiCall) => {
      // No targets means no counts, and answering it here is what settles the query
      if (targetIds.length === 0) {
        return Promise.resolve<ApiResult<CommentCounts>>({ success: true, data: {} })
      }

      // How many comments each of the targets carries
      return getCommentCounts(apiCall, targetType, targetIds)
    },
    // A count reads the same to a visitor with no account
    requireAuth: false,
    // A count can lag a little behind the thread it counts
    ...cachePolicy.counts,
  })

  // The counts and whether more may yet arrive
  return { counts: counts ?? {}, isLoading: isAwaitingAnswer(uiState) }
}
