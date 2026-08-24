'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type { UserCompetitionProfile, UserProfile } from '../model/profile-types'
import { updateUserProfile } from '../services/profile-service'
import { userProfileQueryKeys } from './use-user-profile'

/**
 * Return type for {@link useUpdateProfile}.
 */
type UseUpdateProfileResult = {
  /** Saves what the student says about their competing. Referentially stable for the hook's lifetime. */
  updateProfile: (profile: UserCompetitionProfile) => void
}

/**
 * Saving what a student says about their competing.
 *
 * Whatever refuses it arrives as a toast from the shared mutation.
 *
 * @returns The call that saves.
 */
export function useUpdateProfile(): UseUpdateProfileResult {
  // Profile copy
  const tProfile = useTranslations('profile')

  // The React Query cache
  const queryClient = useQueryClient()

  // Saving it
  const mutation = useOptimisticMutation<void, UserCompetitionProfile>({
    // Hand it to the backend, which is what decides whether it is sayable
    apiFn: (apiCall, profile) => updateUserProfile(apiCall, profile),

    // Echo them into the cache on the pick rather than on the answer. The request replaces every field, so a
    // second pick made while the first is in flight would otherwise read its siblings from before it
    onMutate: (profile) => {
      queryClient.setQueryData<UserProfile>(userProfileQueryKeys.all, (previous) =>
        previous === undefined ? previous : { ...previous, ...profile }
      )
    },

    // Two picks in quick succession land in the order they were made, so the row ends up holding the last one
    scope: { id: 'userProfile' },

    // The reason shown in the auth prompt
    authReason: tProfile('competitionAuthReason'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: tProfile('competitionError'),
  })

  // The mutation's auth-gated caller
  const { mutate } = mutation

  // A function which saves what they say about their competing
  const updateProfile = useCallback((profile: UserCompetitionProfile) => mutate(profile), [mutate])

  // The call that saves
  return { updateProfile }
}
