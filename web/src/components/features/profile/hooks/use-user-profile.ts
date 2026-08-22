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
  /** The address the site has for them, or null when their account carries none. */
  email: string | null
  /** The name the site calls them by, or null while they have yet to choose one. */
  username: string | null
  /** The year they finish secondary school, or null while they have not said or already have. */
  graduationYear: number | null
  /** Whether they are past high school, and so have no age group to be listed against. */
  hasLeftHighSchool: boolean
  /** Where they compete from as an ISO 3166-1 alpha-2 code, or null while they have not said. */
  countryCode: string | null
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
    // Never stale: nothing outside this browser writes any of these, and every call that does echoes its own
    // answer straight into this cache, so there is never a newer one to go and ask for
    staleTime: Infinity,
    // Only fetch once there is a signed-in caller to ask about
    enabled: api.state === 'ready',
  })

  // Their profile, and whether it is known yet
  return {
    email: query.data?.email ?? null,
    username: query.data?.username ?? null,
    graduationYear: query.data?.graduationYear ?? null,
    hasLeftHighSchool: query.data?.hasLeftHighSchool ?? false,
    countryCode: query.data?.countryCode ?? null,
    isLoading: api.state === 'loading' || query.isLoading,
  }
}
