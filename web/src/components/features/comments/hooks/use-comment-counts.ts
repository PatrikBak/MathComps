import { useQuery } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api-error'
import { cachePolicy } from '@/lib/query-config'

import type { CommentTargetType } from '../api/comment-api-types'
import { getCommentCounts } from '../api/comment-service'
import { commentCountQueryKeys } from './comment-query-keys'

/**
 * Hook for bulk-fetching comment counts for multiple targets of the same type.
 *
 * @param targetType - The type of targets (Handout, Problem, or News)
 * @param targetIds - Array of permanent target IDs to get counts for
 *
 * @returns React Query result with a targetId -> count mapping
 */
export function useCommentCounts(targetType: CommentTargetType, targetIds: string[]) {
  // The API client with no authentication (counts are general)
  const api = useApi({ requireAuth: false })

  // Return React Query result with a targetId -> count mapping
  const query = useQuery({
    queryKey: commentCountQueryKeys.forTargetIds(targetType, targetIds),
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // No targets means no counts to fetch
      if (targetIds.length === 0) {
        return {} as Record<string, number>
      }

      // The targetId -> count mapping, or throwing the backend failure
      return unwrap(await getCommentCounts(apiCall, targetType, targetIds))
    },
    // Only fetch if API is ready and there are targetIds
    enabled: api.state === 'ready' && targetIds.length > 0,
    // Counts can lag a little
    ...cachePolicy.counts,
  })

  // Ensure we report loading state when API is still initializing
  return {
    ...query,
    isLoading: api.state !== 'ready' || query.isLoading,
  }
}
