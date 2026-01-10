import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'

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
      // Ensure API is ready
      if (api.state !== 'ready') {
        throw new Error('API not ready')
      }

      // Don't call API for empty targetId arrays
      if (targetIds.length === 0) {
        return {} as Record<string, number>
      }

      // Fetch comment counts from API
      const result = await getCommentCounts(api.apiCall, targetType, targetIds)

      // Ensure API call was successful
      if (!result.success) {
        throw new Error(result.error.message)
      }

      // Return the targetId -> count mapping
      return result.data
    },
    // Only fetch if API is ready and there are targetIds
    enabled: api.state === 'ready' && targetIds.length > 0,
    // Don't refetch too often, 1 minute as counts don't need to be super fresh
    staleTime: 60 * 1000,
  })

  // Ensure we report loading state when API is still initializing
  return {
    ...query,
    isLoading: api.state !== 'ready' || query.isLoading,
  }
}
