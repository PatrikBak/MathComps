'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useInvalidateUserComments } from '@/components/features/comments/hooks/use-invalidate-user-comments'
import { invalidateEntryReadiness } from '@/components/features/hosted-competitions/hooks/hosted-competition-cache'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { UserProfile } from '../model/profile-types'
import { setUsername as setUsernameRequest } from '../services/profile-service'
import { useUserProfileKey } from './use-user-profile'

/**
 * Return type for {@link useSetUsername}.
 */
type UseSetUsernameResult = {
  /** Takes the name for good. Referentially stable for the hook's lifetime. */
  setUsername: (username: string) => void
  /** Whether a name is being taken. */
  isSaving: boolean
}

/**
 * The one chance to choose the name the site calls this user by.
 *
 * Whatever refuses the name, a collision or a broken rule, arrives as a toast from the shared mutation, so a
 * caller does not have to say it twice.
 *
 * @returns The call that claims a name, and whether one is in flight.
 */
export function useSetUsername(): UseSetUsernameResult {
  // Profile copy
  const tProfile = useTranslations('profile')

  // The React Query cache
  const queryClient = useQueryClient()

  // A function which refreshes everything this user has signed
  const { invalidateUserComments } = useInvalidateUserComments()

  // Where this user's profile is cached
  const profileKey = useUserProfileKey()

  // Claiming the name
  const mutation = useOptimisticMutation<void, string>({
    // Hand the name to the backend, which is what decides whether it was still free
    apiFn: (apiCall, username) => setUsernameRequest(apiCall, username),

    // Echo it into the cache, so nothing waits on a refetch to see it. The rest of the profile is left as it
    // was read, since taking a name says nothing about the rest of it
    onSuccess: (_result, username) => {
      queryClient.setQueryData<UserProfile>(profileKey, (previous) =>
        previous === undefined ? previous : { ...previous, username }
      )
    },

    // Refresh what a claimed name changes
    onSettled: () => {
      // Everything this user has authored is signed with the new name
      invalidateUserComments()

      // The name is one of the fields the entry gate reads off the account
      invalidateEntryReadiness(queryClient)
    },

    // The reason shown in the auth prompt
    authReason: tProfile('usernameAuthReason'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: tProfile('usernameError'),
  })

  // The mutation's auth-gated caller
  const { mutate } = mutation

  // A function which claims the name for good
  const setUsername = useCallback((username: string) => mutate(username), [mutate])

  // The call that claims a name, and whether one is in flight
  return {
    setUsername,
    isSaving: mutation.isPending,
  }
}
