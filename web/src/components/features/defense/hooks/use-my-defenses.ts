'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { useApiQuery } from '@/hooks/use-api-query'
import { errorCodeOf, unwrap } from '@/lib/api/api-error'
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
  deleteDefense: (sessionId: string) => Promise<void>
  /** Re-fetches the list. */
  refresh: () => void
}

/**
 * Loads the user's defenses across every problem.
 *
 * @returns The user's defenses, the list's load state, and the controls over them.
 */
export function useMyDefenses(): UseMyDefensesResult {
  // The authenticated API client the delete is made through; 'ready' only when signed in
  const api = useApi({ requireAuth: true })

  // Whose defenses these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // The language the list is read in
  const locale = useLocale()

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
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // Delete it, unwrapped to a throw on failure
      try {
        unwrap(await deleteSession(apiCall, sessionId))
      } catch (error) {
        // A session that is already gone is the outcome the delete was after, not a failure to report
        if (errorCodeOf(error) !== 'DefenseSessionNotFound') {
          throw error
        }
      }
    },
    // Re-sync either way: a success drops the defense, a failure restores it
    onSettled: () => invalidateDefenseLists(queryClient),
  })

  // A function which removes a defense
  const deleteDefense = (sessionId: string) => deleteMutation.mutateAsync(sessionId)

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
