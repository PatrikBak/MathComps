import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { type ApiState, readyApiCall, useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api-error'

import { getContestsBySeasonApiUrl } from '../services/problem-api-urls'
import type { SeasonContestBrowserResult } from '../types/contest-browser-types'

/**
 * Query key for the contest browser data.
 */
const contestBrowserQueryKey = ['problems', 'contests-by-season'] as const

/**
 * Returns the shared query options for fetching contest browser data.
 *
 * @param api - The API client to use.
 *
 * @returns Query options for React Query.
 */
function getQueryOptions(api: ApiState) {
  return {
    queryKey: contestBrowserQueryKey,
    queryFn: async () => {
      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // The contest browser data, or throwing the backend failure
      return unwrap(
        await apiCall<SeasonContestBrowserResult>(() => getContestsBySeasonApiUrl(), {
          method: 'GET',
        })
      )
    },
    // Only fetch when the API is ready
    enabled: api.state === 'ready',
  }
}

/**
 * Hook to fetch and cache contest browser data (competitions grouped by season).
 *
 * @param enabled - Whether to enable the query.
 *
 * @returns The React Query result object.
 */
export function useContestBrowser(enabled: boolean) {
  // We need an API client to talk to the backend
  const api = useApi({ requireAuth: false })

  // Get the query details
  const options = getQueryOptions(api)

  // Return the query, updating the enabled state based on the provided parameter
  return useQuery({ ...options, enabled: enabled && options.enabled })
}

/**
 * Hook to prefetch contest browser data.
 * Call on hover to load data before the modal opens.
 */
export function usePrefetchContestBrowser() {
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
