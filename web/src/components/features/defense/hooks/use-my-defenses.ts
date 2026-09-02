'use client'

import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { useApiQuery } from '@/hooks/use-api-query'
import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { DefenseSessionListItem } from '../model/defense-types'
import { deleteSession, listMyDefenses } from '../services/session-service'
import { invalidateDefenseLists, myDefensesQueryKey } from './defense-cache'

/**
 * The user's cross-problem list of defenses, its load state, and the controls over it.
 */
type UseMyDefensesResult = {
  /** The user's sessions across every problem, most recently active first. */
  defenses: DefenseSessionListItem[]
  /** How far the read of the list got. */
  uiState: QueryUiState
  /** Deletes a defense, refreshing the list afterward. */
  deleteDefense: (sessionId: string) => void
  /** Re-fetches the list. */
  refresh: () => void
}

/**
 * Loads the user's defenses across every problem.
 *
 * @returns The user's defenses, the list's load state, and the controls over them.
 */
export function useMyDefenses(): UseMyDefensesResult {
  // Whose defenses these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // The language the list is read in
  const locale = useLocale()

  // Defense-surface copy
  const t = useTranslations('defense')

  // Cache handle for the defenses list
  const queryClient = useQueryClient()

  // The user's sessions across every problem
  const { data: defenses, uiState } = useApiQuery({
    queryKey: myDefensesQueryKey(isUserLoaded ? (userId ?? null) : null, locale),
    fetch: listMyDefenses,
    // The user's own conversations, so they are read as them
    requireAuth: true,
    // Only fetch once the key's user is settled, or the list lands under the wrong one
    enabled: isUserLoaded,
    // The user's own recent activity
    ...cachePolicy.userData,
  })

  // Removes a defense from the store
  const deleteMutation = useOptimisticMutation<void, string>({
    apiFn: async (apiCall, sessionId) => {
      // The delete as the backend settled it
      const result = await deleteSession(apiCall, sessionId)

      // A session that is already gone is the outcome the delete was after, not a failure to report
      if (!result.success && result.error.errorCode === 'DefenseSessionNotFound') {
        return { success: true, data: undefined }
      }

      // The delete as it landed
      return result
    },

    // Re-sync either way: a success drops the defense, a failure restores it
    onSettled: () => invalidateDefenseLists(queryClient),

    // The reason shown in the auth prompt
    authReason: t('deleteAuthReason'),

    // Fallback copy when the failure carried no recognized code
    errorMessage: t('deleteError'),
  })

  // A function which removes a defense
  const deleteDefense = deleteMutation.mutate

  // A function which reads the list again
  const refresh = () => invalidateDefenseLists(queryClient)

  // The list, its load state, and the controls over it
  return {
    defenses: defenses ?? [],
    uiState,
    deleteDefense,
    refresh,
  }
}
