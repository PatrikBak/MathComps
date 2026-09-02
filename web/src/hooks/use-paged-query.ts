'use client'

import type { QueryKey } from '@tanstack/react-query'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import type { ApiCaller } from '@/hooks/use-api'
import { abortableCall, apiCallOf, readyApiCall, useApi } from '@/hooks/use-api'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { unwrap } from '@/lib/api/api-error'
import type { PagedList } from '@/lib/api/paged-list'
import type { CachePolicyTier } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'
import type { ApiResult } from '@/types/api'

/**
 * How to read one paged endpoint.
 *
 * @template TItem - What a page of results holds.
 */
type UsePagedQueryOptions<TItem> = {
  /** What caches it. */
  queryKey: QueryKey
  /**
   * Fetches one page, counting from 1, through the caller, which is ready by the time this runs and
   * already carries React Query's abort signal, so a page the reader has scrolled past is dropped.
   */
  fetchPage: (apiCall: ApiCaller, pageNumber: number) => Promise<ApiResult<PagedList<TItem>>>
  /** Whether the read needs somebody signed in. */
  requireAuth: boolean
  /**
   * Whatever else has to be true before the read is worth making, over and above there being a caller.
   */
  enabled?: boolean
  /** Cache-freshness tier to run it under. */
  cachePolicy: CachePolicyTier
}

/**
 * What {@link usePagedQuery} hands back.
 *
 * @template TItem - What a page of results holds.
 */
type UsePagedQueryResult<TItem> = {
  /** Every page loaded so far, in the order they were asked for. */
  pages: PagedList<TItem>[]
  /** How many results the narrowing leaves in all, held steady while further pages load. */
  totalCount: number
  /** Whether more pages remain. */
  hasMore: boolean
  /** Whether another page is on its way. */
  isLoadingMore: boolean
  /** Asks for the next page, ignoring an ask there is nothing to answer. */
  loadMore: () => void
  /** Runs the query again after it gave up. */
  retry: () => void
  /** The state of the fetch. */
  uiState: QueryUiState
}

/**
 * Reads a paged endpoint, keeping every page loaded so far.
 *
 * One place for what a paged surface would otherwise derive for itself: whether a further page exists, which
 * is the same arithmetic over a page number, a page size and a total wherever the counts come from, and when
 * an ask for one should be ignored.
 *
 * A failed page does not close {@link UsePagedQueryResult.loadMore} off, since the control a reader clicks
 * after seeing the failure is the same one. What must not repeat itself is the *automatic* ask, and that is
 * the caller's own call to make from {@link UsePagedQueryResult.uiState}.
 *
 * @template TItem - What a page of results holds.
 * @param options - How to read the endpoint.
 *
 * @returns The pages and the way on, as described by {@link UsePagedQueryResult}.
 */
export function usePagedQuery<TItem>({
  queryKey,
  fetchPage,
  requireAuth,
  enabled = true,
  cachePolicy,
}: UsePagedQueryOptions<TItem>): UsePagedQueryResult<TItem> {
  // The API client
  const api = useApi({ requireAuth })

  // The ready caller, or null while it is still loading or nobody is signed in
  const apiCall = apiCallOf(api)

  // The pages themselves
  const query = useInfiniteQuery({
    queryKey,
    // The page, or throwing the backend failure. The gate below keeps this from running without a
    // caller, and readyApiCall is the one assertion that says so if it ever does
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await fetchPage(abortableCall(readyApiCall(api), signal), pageParam)),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      // More pages remain while the results seen so far fall short of the total
      lastPage.page * lastPage.pageSize < lastPage.totalCount ? lastPage.page + 1 : undefined,
    ...cachePolicy,
    // Held shut until there is a caller, and until whatever else the call site asked for is true
    enabled: enabled && apiCall !== null,
  })

  // Reduce the raw flags to the one state that describes this fetch
  const uiState = useQueryUiState(query)

  // The query's own handles, which stay put across renders where the result object around them doesn't
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query

  // Asks for the next page, unless one is already on its way
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Runs the query again after it gave up. React Query's own refetch ignores `enabled`, so the readiness
  // the gate above stands for has to be asked again here
  const retry = useCallback(() => {
    if (enabled && apiCall !== null) void refetch()
  }, [enabled, apiCall, refetch])

  // The pages as loaded, left for the caller to flatten: what a page holds is its own business. Held steady
  // across renders so a caller memoizing off it isn't recomputing against a fresh empty array every time.
  const pages = useMemo(() => query.data?.pages ?? [], [query.data])

  // The pages so far, and the way on
  return {
    pages,
    totalCount: pages.length === 0 ? 0 : pages[0].totalCount,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    loadMore,
    retry,
    uiState,
  }
}
