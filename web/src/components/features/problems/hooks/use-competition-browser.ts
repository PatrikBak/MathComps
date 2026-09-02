import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { type ApiState, useApi } from '@/hooks/use-api'
import { apiQueryOptions } from '@/hooks/use-api-query'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { isAwaitingAnswer, type QueryUiState } from '@/lib/query-ui-state'

import { getCompetitionsBySeasonApiUrl } from '../services/problem-api-urls'
import type { SeasonCompetitionBrowserResult } from '../types/competition-browser-types'

/**
 * Query key for the competition browser data.
 */
const competitionBrowserQueryKey = ['problems', 'competitions-by-season'] as const

/**
 * The read of every competition grouped by season, built the once so that
 * {@link usePrefetchCompetitionBrowser} warms the very key {@link useCompetitionBrowser} looks at.
 *
 * @param api - The client the read goes through.
 *
 * @returns The options, ready for `useQuery` or `prefetchQuery`.
 */
function competitionBrowserOptions(api: ApiState) {
  // The competitions, read with whatever caller there is: nobody has to be signed in for these
  return apiQueryOptions(api, {
    queryKey: competitionBrowserQueryKey,
    fetch: (apiCall) =>
      apiCall<SeasonCompetitionBrowserResult>(() => getCompetitionsBySeasonApiUrl(), {
        method: 'GET',
      }),
  })
}

/**
 * What {@link useCompetitionBrowser} hands back.
 */
type UseCompetitionBrowserResult = {
  /** Every competition grouped by season, and nothing until the read has answered. */
  data: SeasonCompetitionBrowserResult | undefined
  /** Whether an answer may still be coming. */
  isAwaitingAnswer: boolean
  /** How far the read has got. */
  uiState: QueryUiState
}

/**
 * Every competition there is, grouped by the season it ran in.
 *
 * @param enabled - Whether the browser is open, since a closed one is not worth the read.
 *
 * @returns The competitions and the state of the fetch, as described by
 *   {@link UseCompetitionBrowserResult}.
 */
export function useCompetitionBrowser(enabled: boolean): UseCompetitionBrowserResult {
  // The API client, which this read needs nobody signed in behind
  const api = useApi({ requireAuth: false })

  // The read as React Query wants it
  const options = competitionBrowserOptions(api)

  // The read itself, held shut while the browser is closed as well as until there is a caller
  const query = useQuery({ ...options, enabled: enabled && options.enabled })

  // Reduce the raw flags to the one state that describes this fetch
  const uiState = useQueryUiState(query)

  // The competitions, and how the fetch is going
  return {
    data: query.data,
    isAwaitingAnswer: isAwaitingAnswer(uiState),
    uiState,
  }
}

/**
 * Warms the competition browser's cache, so opening it finds the competitions already there.
 *
 * @returns A function which warms the cache.
 */
export function usePrefetchCompetitionBrowser(): () => void {
  // The API client, which this read needs nobody signed in behind
  const api = useApi({ requireAuth: false })

  // What holds the cache the prefetch writes into
  const queryClient = useQueryClient()

  // The prefetch itself
  return useCallback(() => {
    // The read as React Query wants it
    const options = competitionBrowserOptions(api)

    // Nothing to prefetch with until there is a caller
    if (!options.enabled) return

    // Warm the cache
    void queryClient.prefetchQuery(options)
  }, [api, queryClient])
}
