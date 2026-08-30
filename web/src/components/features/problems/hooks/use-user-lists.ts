import { useAuth } from '@clerk/nextjs'
import type { QueryKey } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'

import { getUserListsApiUrl } from '../services/user-list-api-urls'
import type { UserListsResponse } from '../types/user-list-types'

/**
 * Query keys for user lists, used for cache management. The user rides below the root, so an invalidation over
 * {@link userListQueryKeys.all} still reaches whichever account's lists are cached.
 */
export const userListQueryKeys = {
  all: ['userLists'] as const,
  lists: (userId: string | null) => [...userListQueryKeys.all, 'lists', userId] as const,
}

/**
 * The key the signed-in user's own lists are cached under: the read, and every write that echoes into it.
 *
 * Keyed by user, since signing out and back in as somebody else never reloads the page, and an entry cached
 * under anything less hands the second reader the first one's lists.
 *
 * One hook for all of them, so a write cannot address a key the read never wrote to, which lands nowhere and
 * says nothing.
 *
 * @returns The key.
 */
export function useUserListsKey(): QueryKey {
  // Whose lists they are, once Clerk knows
  const { userId, isLoaded } = useAuth()

  // The key, holding the user as null until Clerk has settled who they are
  return userListQueryKeys.lists(isLoaded ? (userId ?? null) : null)
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
  /** Whether the query settled into an error after exhausting retries */
  isError: boolean
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

  // Where this user's lists are cached
  const listsKey = useUserListsKey()

  // React Query query
  const query = useQuery({
    queryKey: listsKey,
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
    isError: query.isError,
    isReady: api.state === 'ready',
  }
}
