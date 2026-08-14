import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { type ApiState, readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api/api-error'

import { getCompetitionsBySeasonApiUrl } from '../services/problem-api-urls'
import type { SeasonCompetitionBrowserResult } from '../types/competition-browser-types'

/**
 * Query key for the competition browser data.
 */
const competitionBrowserQueryKey = ['problems', 'competitions-by-season'] as const

/**
 * Returns the shared query options for fetching competition browser data.
 *
 * @param api - The API client to use.
 *
 * @returns Query options for React Query.
 */
function getQueryOptions(api: ApiState) {
  return {
    queryKey: competitionBrowserQueryKey,
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // The competition browser data, or throwing the backend failure
      return unwrap(
        await apiCall<SeasonCompetitionBrowserResult>(() => getCompetitionsBySeasonApiUrl(), {
          method: 'GET',
        })
      )
    },
    // Only fetch when the API is ready
    enabled: api.state === 'ready',
  }
}

/**
 * Hook to fetch and cache competition browser data (competitions grouped by season).
 *
 * @param enabled - Whether to enable the query.
 *
 * @returns The React Query result object.
 */
export function useCompetitionBrowser(enabled: boolean) {
  // We need an API client to talk to the backend
  const api = useApi({ requireAuth: false })

  // Get the query details
  const options = getQueryOptions(api)

  // Return the query, updating the enabled state based on the provided parameter
  return useQuery({ ...options, enabled: enabled && options.enabled })
}

/**
 * Hook to prefetch competition browser data.
 * Call on hover to load data before the modal opens.
 */
export function usePrefetchCompetitionBrowser() {
  // We need an API client to talk to the backend
  const api = useApi({ requireAuth: false })

  // Get the React Query client
  const queryClient = useQueryClient()

  // Return the function doing the prefetch
  return useCallback(() => {
    // Get the query details
    const options = getQueryOptions(api)

    // Ensure the query is ready
    if (!options.enabled) return

    // Do the prefetch
    queryClient.prefetchQuery(options)
  }, [api, queryClient])
}
