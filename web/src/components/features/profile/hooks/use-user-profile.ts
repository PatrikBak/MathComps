'use client'

import { useQuery } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api/api-error'

import { getUserProfile } from '../services/profile-service'

/**
 * Query keys for the signed-in user's own profile, used for cache management.
 */
export const userProfileQueryKeys = {
  all: ['userProfile'] as const,
}

/**
 * Return type for {@link useUserProfile}.
 */
type UseUserProfileResult = {
  /** The name the site calls them by, or null while they have yet to choose one. */
  username: string | null
  /** Whether the answer is still being read, so neither state is known yet. */
  isLoading: boolean
}

/**
 * What the site holds on the signed-in user.
 *
 * A read that failed reports no username, which is the safe way round: it offers the choice again rather than
 * letting somebody comment under a name nobody confirmed.
 *
 * @returns Their profile, and whether it is known yet.
 */
export function useUserProfile(): UseUserProfileResult {
  // API client for the signed-in caller
  const api = useApi({ requireAuth: true })

  // What the site holds on them
  const query = useQuery({
    queryKey: userProfileQueryKeys.all,
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // Their profile, or throwing the backend failure
      return unwrap(await getUserProfile(apiCall))
    },
    // Never stale: the name is null exactly until this person takes one, and the call that takes it
    // writes the answer straight into this cache. Nothing else can move it, so nothing needs re-asking
    staleTime: Infinity,
    // Only fetch once there is a signed-in caller to ask about
    enabled: api.state === 'ready',
  })

  // Their profile, and whether it is known yet
  return {
    username: query.data?.username ?? null,
    isLoading: api.state === 'loading' || query.isLoading,
  }
}
