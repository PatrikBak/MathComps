'use client'

import type { QueryFunctionContext, QueryKey, UseQueryOptions } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import type { ApiCaller, ApiState } from '@/hooks/use-api'
import { abortableCall, apiCallOf, readyApiCall, useApi } from '@/hooks/use-api'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { unwrap } from '@/lib/api/api-error'
import { isAwaitingAnswer as awaitsAnswer, type QueryUiState } from '@/lib/query-ui-state'
import type { ApiResult } from '@/types/api'

/**
 * A read through an API client: an ordinary React Query read whose fetch is handed a ready
 * {@link ApiCaller} and hands back an {@link ApiResult}.
 *
 * @template TData - What the read answers with.
 */
type ApiQueryOptions<TData> = Omit<
  UseQueryOptions<TData, Error, TData, QueryKey>,
  'queryFn' | 'enabled'
> & {
  /**
   * Reads the data through the caller, which is ready by the time this runs and already carries React
   * Query's abort signal, so a read the reader has moved on from is dropped rather than waited out.
   */
  fetch: (apiCall: ApiCaller) => Promise<ApiResult<TData>>
  /**
   * Whatever else has to be true before the read is worth making.
   *
   * Named rather than left to the spread: this is ANDed with the readiness gate, and one arriving through
   * the rest of the options would overwrite that gate and fire the read before there is a caller to make
   * it with.
   */
  enabled?: boolean
}

/**
 * What {@link useApiQuery} is asked for: a read, plus who it has to be made as.
 *
 * @template TData - What the read answers with.
 */
type UseApiQueryOptions<TData> = ApiQueryOptions<TData> & {
  /**
   * Whether the read needs somebody signed in. Stated at every call site rather than defaulted, because
   * getting it wrong on a public read gives a query that quietly never fires and never errors.
   */
  requireAuth: boolean
}

/**
 * What {@link useApiQuery} hands back.
 *
 * @template TData - What the read answers with.
 */
type UseApiQueryResult<TData> = {
  /** What the last read that got through came back with, and nothing until one has. */
  data: TData | undefined
  /** How far the read has got. */
  uiState: QueryUiState
  /**
   * Whether a request is in flight right now, a background refresh over data already on screen included.
   * That last case is the one {@link UseApiQueryResult.uiState} hides, so a placeholder never blanks out
   * content the reader can see.
   */
  isFetching: boolean
  /** Reads it again after it gave up. Holds its identity across renders. */
  retry: () => void
  /**
   * Whether an answer may still be coming, so nothing read off this hook is settled yet.
   *
   * {@link UseApiQueryResult.uiState} spells loading two ways, a request in flight and a read still
   * gated, and a read wanting `requireAuth` with nobody signed in is gated for good. This tells the two
   * apart, so a control hanging on it doesn't hang forever on a visitor with no account.
   */
  isAwaitingAnswer: boolean
}

/**
 * The React Query options for reading an endpoint through an API client: the caller narrowed and bound to
 * the abort signal, the {@link ApiResult} unwrapped, and the read held shut until there is a caller.
 *
 * A plain function rather than a hook, so a prefetch hands the very same options to `prefetchQuery` that
 * {@link useApiQuery} reads with, and both land on one key.
 *
 * @template TData - What the read answers with.
 * @param api - The client the read goes through.
 * @param options - What to read, and what has to hold before it is worth reading.
 *
 * @returns The options, ready for `useQuery` or `prefetchQuery`.
 */
export function apiQueryOptions<TData>(
  api: ApiState,
  { fetch: fetchData, enabled = true, ...queryOptions }: ApiQueryOptions<TData>
) {
  // The ready caller, or null while it is still loading or nobody is signed in
  const apiCall = apiCallOf(api)

  // The read, held shut until there is a caller and until whatever else the call site asked for is true
  return {
    ...queryOptions,
    // The data, or throwing the backend failure. The gate below keeps this from running without a
    // caller, and readyApiCall is the one assertion that says so if it ever does
    queryFn: async ({ signal }: QueryFunctionContext<QueryKey>) =>
      unwrap(await fetchData(abortableCall(readyApiCall(api), signal))),
    enabled: enabled && apiCall !== null,
  }
}

/**
 * An authenticated React Query read: it waits for the API client, unwraps the result, and stays disabled
 * until there is a caller to make the call with.
 *
 * A caller that also prefetches builds its options with {@link apiQueryOptions} and reads them itself.
 *
 * @template TData - What the read answers with.
 * @param options - What to read, who to read it as, and what has to hold before it is worth reading.
 *
 * @returns The data and the state of the fetch, as described by {@link UseApiQueryResult}.
 */
export function useApiQuery<TData>({
  requireAuth,
  ...options
}: UseApiQueryOptions<TData>): UseApiQueryResult<TData> {
  // The API client
  const api = useApi({ requireAuth })

  // Whether the read is held shut on a visitor with no account, which no waiting will change
  const isSignedOut = api.state === 'unauthenticated'

  // The read as React Query wants it
  const queryOptions = apiQueryOptions(api, options)

  // The read itself
  const query = useQuery(queryOptions)

  // Reduce the raw flags to the one state that describes this fetch
  const uiState = useQueryUiState(query)

  // Whether the wait can still end. A read held shut on a missing account cannot, so the loading it
  // reports is one nobody should sit through
  const isAwaitingAnswer = !isSignedOut && awaitsAnswer(uiState)

  // Whether the read is allowed to run at all
  const isEnabled = queryOptions.enabled

  // The query's own handle, which stays put across renders where the result object around it doesn't
  const { refetch } = query

  // Reads it again after it gave up. React Query's own refetch ignores `enabled`, so the readiness the
  // gate above stands for has to be asked again here
  const retry = useCallback(() => {
    if (isEnabled) void refetch()
  }, [isEnabled, refetch])

  // What came back, and how the fetch is going, held steady while none of it moves
  return useMemo(
    () => ({ data: query.data, uiState, isFetching: query.isFetching, retry, isAwaitingAnswer }),
    [query.data, uiState, query.isFetching, retry, isAwaitingAnswer]
  )
}
