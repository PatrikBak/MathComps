import { useAuth } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api-error'
import { cachePolicy } from '@/lib/query-config'

import type { CommentTarget } from '../services/comment-api-types'
import { getComments } from '../services/comment-service'
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
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // The target's comments, or throwing the backend failure
      return unwrap(await getComments(apiCall, target))
    },
    // Wait for both API and auth to be ready before fetching
    enabled: api.state === 'ready' && isUserLoaded,
    // Threads should reflect new replies quickly
    ...cachePolicy.userData,
  })

  // Return query with proper loading state that accounts for initialization
  return {
    ...query,
    isLoading: api.state !== 'ready' || !isUserLoaded || query.isLoading,
  }
}
