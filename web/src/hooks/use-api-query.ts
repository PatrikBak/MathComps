'use client'

import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'

import type { ApiCaller } from '@/hooks/use-api'
import { useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api/api-error'
import type { ApiResult } from '@/types/api'

/**
 * What {@link useApiQuery} is asked for: an ordinary React Query read whose fetch is handed a ready
 * {@link ApiCaller} and hands back an {@link ApiResult}.
 */
type UseApiQueryOptions<TData> = Omit<
  UseQueryOptions<TData, Error, TData, QueryKey>,
  'queryFn' | 'enabled'
> & {
  /** Reads the data through the caller, which is ready by the time this runs. */
  fetch: (apiCall: ApiCaller) => Promise<ApiResult<TData>>
  /**
   * Whether the read needs somebody signed in. Stated at every call site rather than defaulted, because
   * getting it wrong on a public read gives a query that quietly never fires and never errors.
   */
  requireAuth: boolean
  /**
   * Whatever else has to be true before the read is worth making.
   *
   * Named rather than left to the spread: this is ANDed with the readiness gate, and one arriving through
   * `queryOptions` would overwrite that gate and fire the read before there is a caller to make it with.
   */
  enabled?: boolean
}

/**
 * An authenticated React Query read: it waits for the API client, unwraps the result, and stays disabled
 * until there is a caller to make the call with.
 *
 * @returns The query, exactly as React Query hands it back.
 */
export function useApiQuery<TData>({
  fetch: fetchData,
  requireAuth,
  enabled = true,
  ...queryOptions
}: UseApiQueryOptions<TData>): UseQueryResult<TData, Error> {
  // The API client
  const api = useApi({ requireAuth })

  // The ready caller, or null while it is still loading or nobody is signed in
  const apiCall = api.state === 'ready' ? api.apiCall : null

  // The read itself, which never runs without a caller
  return useQuery({
    ...queryOptions,
    queryFn: async () => {
      // The read never fires without a caller, so reaching here without one is a bug
      if (apiCall === null) {
        throw new Error('The API client is not ready')
      }

      // The data, or throwing the backend failure
      return unwrap(await fetchData(apiCall))
    },

    // Held shut until there is a caller, and until whatever else the call site asked for is true
    enabled: enabled && apiCall !== null,
  })
}
