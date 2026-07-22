import { useQuery } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api-error'
import { cachePolicy } from '@/lib/query-config'

import { getUserListsApiUrl } from '../services/user-list-api-urls'
import type { UserListsResponse } from '../types/user-list-types'

/**
 * Query keys for user lists, used for cache management.
 */
export const userListQueryKeys = {
  all: ['userLists'] as const,
  lists: () => [...userListQueryKeys.all, 'lists'] as const,
}

/**
 * Return type for {@link useUserLists}.
 */
type UseUserListsResult = {
  /** The user's lists, undefined while loading or not signed in */
  lists: UserListsResponse['lists'] | undefined
  /** Number of problems the user has liked, undefined while loading */
  likedCount: number | undefined
  /** Whether the lists are currently loading */
  isLoading: boolean
  /** Whether the API client is ready (user is signed in) */
  isReady: boolean
}

/**
 * Hook to fetch the authenticated user's problem lists.
 * Only fetches when the user is signed in and the API client is ready.
 *
 * @returns The user's lists data, loading state, and readiness state
 */
export function useUserLists(): UseUserListsResult {
  // API client — requires auth, so it will be 'ready' only when signed in
  const api = useApi({ requireAuth: true })

  // React Query query
  const query = useQuery({
    queryKey: userListQueryKeys.lists(),
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // The user's lists, or throwing the backend failure
      return unwrap(await apiCall<UserListsResponse>(() => getUserListsApiUrl(), { method: 'GET' }))
    },
    // The user's own lists should reflect their edits quickly
    ...cachePolicy.userData,
    // Only fetch when the API is ready (user is authenticated)
    enabled: api.state === 'ready',
  })

  // Return the data
  return {
    lists: query.data?.lists,
    likedCount: query.data?.likedCount,
    isLoading: query.isLoading,
    isReady: api.state === 'ready',
  }
}
