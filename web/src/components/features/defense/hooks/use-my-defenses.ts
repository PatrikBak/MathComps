'use client'

import { useAuth } from '@clerk/nextjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { errorCodeOf, unwrap } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'

import type { DefenseSessionListItem } from '../model/defense-types'
import { deleteSession, listMyDefenses } from '../services/session-service'
import { invalidateDefenseLists, myDefensesQueryKey } from './defense-cache'

/**
 * The user's cross-problem list of defenses, its load state, and the controls over it.
 */
type UseMyDefensesResult = {
  /** The user's sessions across every problem, most recently active first. */
  defenses: DefenseSessionListItem[]
  /** Whether the list is still loading. */
  isLoading: boolean
  /** Whether loading the list failed. */
  isError: boolean
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
  // The authenticated API client; 'ready' only when signed in
  const api = useApi({ requireAuth: true })

  // Whose defenses these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Cache handle for the defenses list
  const queryClient = useQueryClient()

  // The user's sessions across every problem
  const query = useQuery({
    queryKey: myDefensesQueryKey(isUserLoaded ? (userId ?? null) : null),
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // Fetch the list, unwrapped to the sessions or a throw
      return unwrap(await listMyDefenses(apiCall))
    },
    // The user's own recent activity
    ...cachePolicy.userData,
    // Only fetch once the client is ready and the key's user is settled
    enabled: api.state === 'ready' && isUserLoaded,
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
    defenses: query.data ?? [],
    isLoading: api.state !== 'ready' || !isUserLoaded || query.isLoading,
    isError: query.isError,
    deleteDefense,
    refresh,
  }
}
