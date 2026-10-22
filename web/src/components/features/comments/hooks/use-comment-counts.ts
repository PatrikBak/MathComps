import { keepPreviousData } from '@tanstack/react-query'

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
  /**
   * How many comments each target carries, keyed by target id; empty until the first read lands, and the previous
   * set's counts while a new set is being read.
   */
  counts: CommentCounts
  /** Whether the first counts may still be coming. */
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
    // A visitor reads the counts of the threads open to everybody, so the call goes out without
    // an account
    requireAuth: false,
    // Anybody can comment, so the counts keep up while they are on screen
    cachePolicy: cachePolicy.live,
    // A set gaining or losing a target is read anew, and the counts already shown stay up until that read lands
    placeholderData: keepPreviousData,
  })

  // The counts and whether more may yet arrive
  return { counts: counts ?? {}, isLoading: isAwaitingAnswer(uiState) }
}
