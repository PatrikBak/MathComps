'use client'

import { useAuth } from '@clerk/nextjs'
import type { QueryKey } from '@tanstack/react-query'

import { useApiQuery } from '@/hooks/use-api-query'

import { getUserProfile } from '../services/profile-service'

/**
 * Query keys for the signed-in user's own profile, used for cache management.
 */
const userProfileQueryKeys = {
  all: ['userProfile'] as const,
  forUser: (userId: string | null) => [...userProfileQueryKeys.all, userId] as const,
}

/**
 * The key the signed-in user's own profile is cached under: the read, and every write that echoes into it.
 *
 * Keyed by user, since signing out and back in as somebody else never reloads the page, and an entry cached
 * under anything less hands the second reader the first one's name and address.
 *
 * One hook for all of them, so a write cannot address a key the read never wrote to, which lands nowhere and
 * says nothing.
 *
 * @returns The key.
 */
export function useUserProfileKey(): QueryKey {
  // Whose profile it is, once Clerk knows
  const { userId, isLoaded } = useAuth()

  // The key, holding the user as null until Clerk has settled who they are
  return userProfileQueryKeys.forUser(isLoaded ? (userId ?? null) : null)
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
  /**
   * Whether an answer may still be coming, so nothing here is settled yet. False for a visitor with no
   * account, who has no profile to wait for and whose wait would never end.
   */
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
  // Where this user's profile is cached
  const profileKey = useUserProfileKey()

  // What the site holds on them
  const { data: profile, isAwaitingAnswer } = useApiQuery({
    queryKey: profileKey,
    fetch: getUserProfile,
    // Their own profile, so it is read as them
    requireAuth: true,
    // Never stale: nothing outside this browser writes any of these, and every call that does echoes its own
    // answer straight into this cache, so there is never a newer one to go and ask for
    staleTime: Infinity,
  })

  // Their profile, and whether it is known yet
  return {
    email: profile?.email ?? null,
    username: profile?.username ?? null,
    graduationYear: profile?.graduationYear ?? null,
    hasLeftHighSchool: profile?.hasLeftHighSchool ?? false,
    countryCode: profile?.countryCode ?? null,
    isLoading: isAwaitingAnswer,
  }
}
