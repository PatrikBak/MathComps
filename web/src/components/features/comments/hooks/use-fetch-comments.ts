import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'

import { useApi } from '@/hooks/use-api'

import type { CommentTarget } from '../api/comment-api-types'
import { getComments } from '../api/comment-service'
import { commentQueryKeys } from './comment-query-keys'

/**
 * Hook for fetching comments for a specific target.
 *
 * @param target - The target to fetch comments for.
 *
 * @returns React Query result with comments array.
 */
export function useFetchComments(target: CommentTarget) {
  // Use the API, which doesn't require authentication
  const api = useApi({ requireAuth: false })

  // Get Clerk user ID and load state
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Get user id or null if not loaded / not authenticated
  const safeUserId = isUserLoaded ? (userId ?? null) : null

  // Fetch comments from API
  const query = useQuery({
    queryKey: commentQueryKeys.target(target, safeUserId),
    queryFn: async () => {
      // Ensure API is ready
      if (api.state !== 'ready') {
        throw new Error('API not ready')
      }

      // Fetch comments from API
      const result = await getComments(api.apiCall, target)

      // Ensure API call was successful
      if (!result.success) {
        throw new Error(result.error.message)
      }

      // Happy path
      return result.data
    },
    // Wait for both API and auth to be ready before fetching
    enabled: api.state === 'ready' && isUserLoaded,
    // Cache for 30 seconds
    staleTime: 30 * 1000,
  })

  // Return query with proper loading state that accounts for initialization
  return {
    ...query,
    isLoading: api.state !== 'ready' || !isUserLoaded || query.isLoading,
  }
}
