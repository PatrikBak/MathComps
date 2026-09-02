import { useAuth } from '@clerk/nextjs'
import type { QueryKey } from '@tanstack/react-query'

import { useApiQuery } from '@/hooks/use-api-query'
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
  /**
   * Whether an answer may still be coming, so an empty set of lists is not yet the answer. False for a
   * visitor with no account, whose lists are never read for and whose wait would never end.
   */
  isLoading: boolean
  /** Whether the query settled into an error after exhausting retries */
  isError: boolean
}

/**
 * Hook to fetch the authenticated user's problem lists.
 * Only fetches when the user is signed in and the API client is ready.
 *
 * @returns The user's lists data, loading state, and readiness state
 */
export function useUserLists(): UseUserListsResult {
  // Where this user's lists are cached
  const listsKey = useUserListsKey()

  // The user's own lists
  const {
    data: userLists,
    uiState,
    isAwaitingAnswer,
  } = useApiQuery({
    queryKey: listsKey,
    fetch: (apiCall) => apiCall<UserListsResponse>(() => getUserListsApiUrl(), { method: 'GET' }),
    // Their own lists, so they are read as them
    requireAuth: true,
    // The user's own lists should reflect their edits quickly
    ...cachePolicy.userData,
  })

  // Return the data
  return {
    lists: userLists?.lists,
    likedCount: userLists?.likedCount,
    isLoading: isAwaitingAnswer,
    isError: uiState.kind === 'failed',
  }
}
