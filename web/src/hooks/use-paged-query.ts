'use client'

import type { QueryKey } from '@tanstack/react-query'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'

import { useQueryUiState } from '@/hooks/use-query-ui-state'
import type { PagedList } from '@/lib/api/paged-list'
import type { CachePolicyTier } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * How to read one paged endpoint.
 *
 * @template TItem - What a page of results holds.
 */
type UsePagedQueryOptions<TItem> = {
  /** What caches it. */
  queryKey: QueryKey
  /** Fetches one page, counting from 1. */
  fetchPage: (pageNumber: number, signal: AbortSignal) => Promise<PagedList<TItem>>
  /** Whether it is worth reading at all. */
  enabled: boolean
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
  /** Whether the last attempt gave up. */
  hasFailed: boolean
  /** Asks for the next page, ignoring an ask there is nothing to answer. Holds its identity across renders. */
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
 * the caller's own call to make from {@link UsePagedQueryResult.hasFailed}.
 *
 * @template TItem - What a page of results holds.
 * @param options - How to read the endpoint.
 * @returns The pages and the way on, as described by {@link UsePagedQueryResult}.
 */
export function usePagedQuery<TItem>({
  queryKey,
  fetchPage,
  enabled,
  cachePolicy,
}: UsePagedQueryOptions<TItem>): UsePagedQueryResult<TItem> {
  // The pages themselves
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      // More pages remain while the results seen so far fall short of the total
      lastPage.page * lastPage.pageSize < lastPage.totalCount ? lastPage.page + 1 : undefined,
    ...cachePolicy,
    enabled,
  })

  // Reduce the raw flags to the one state that describes this fetch
  const uiState = useQueryUiState(query)

  // The query's own handles, which stay put across renders where the result object around them doesn't
  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = query

  // The guards as they stand right now, read through a ref so that `loadMore` can keep its identity: a
  // sentinel asking for a page as it scrolls into view fires again whenever the callback changes under it,
  // and a page landing is exactly such a change, so a moving callback costs a page per page
  const guards = useRef({ hasNextPage, isFetchingNextPage })
  guards.current = { hasNextPage, isFetchingNextPage }

  // Asks for the next page, unless one is already on its way
  const loadMore = useCallback(() => {
    if (guards.current.hasNextPage && !guards.current.isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage])

  // Runs the query again after it gave up
  const retry = useCallback(() => void refetch(), [refetch])

  // The pages as loaded, left for the caller to flatten: what a page holds is its own business. Held steady
  // across renders so a caller memoizing off it isn't recomputing against a fresh empty array every time.
  const pages = useMemo(() => query.data?.pages ?? [], [query.data])

  // The pages so far, and the way on
  return {
    pages,
    totalCount: pages.length === 0 ? 0 : pages[0].totalCount,
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    hasFailed: uiState.kind === 'failed',
    loadMore,
    retry,
    uiState,
  }
}
