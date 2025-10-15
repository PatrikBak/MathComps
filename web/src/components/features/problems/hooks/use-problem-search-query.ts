'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { DEFAULT_PAGE_SIZE } from '../constants/pagination-constants'
import { CACHE_TIMING } from '../constants/timing-constants'
import { getInitialFilterData, getProblemBySlug, searchProblems } from '../services/problem-service'
import { isProblemNotFoundError } from '../types/problem-errors'
import type { FilterResponse, SearchFiltersState } from '../types/problem-library-types'

/**
 * Query key factory for problem search queries.
 * This ensures consistent cache keys across the application.
 */
const problemQueryKeys = {
  // Base key for all problem-related queries
  all: ['problems'] as const,

  // Key for initial filter data (all available options)
  initialData: () => [...problemQueryKeys.all, 'initial'] as const,

  // Key for problem search results with specific filters
  search: (filters: SearchFiltersState | null) =>
    [...problemQueryKeys.all, 'search', filters] as const,

  // Key for a single problem by slug
  single: (slug: string | null) => [...problemQueryKeys.all, 'single', slug] as const,
}

/**
 * Hook to fetch initial filter data, i.e. filter options + the first batch of problems
 * Used during the initial page load to populate filter dropdowns.
 */
export function useInitialFilterData() {
  // Construct the React Query
  const query = useQuery({
    queryKey: problemQueryKeys.initialData(),
    queryFn: async () => {
      // Fetch the initial filter options from the server
      const result = await getInitialFilterData()

      // Throw typed error if the server request failed so React Query can retry
      if (!result.isSuccess) {
        throw result.error
      }

      // Ensure we received valid filter options before proceeding
      if (!result.value.updatedOptions) {
        throw new Error('No filter options received from server')
      }

      // Should be gud
      return result.value
    },
    // Initial data rarely changes, so we can cache it aggressively
    staleTime: CACHE_TIMING.staleTime,
    gcTime: CACHE_TIMING.gcTime,
  })

  return {
    ...query,
    // Expose retry state - failureCount > 0 means we're retrying after failure (show toast even between retries)
    isRetrying: query.failureCount > 0,
  }
}

/**
 * Hook to fetch a single problem by its slug.
 * Used when the URL contains an `id` parameter pointing to a specific problem.
 *
 * @param slug - The problem slug from the URL (null if not viewing a single problem)
 * @param enabled - Whether the query should run
 */
export function useSingleProblem(slug: string | null, enabled = true) {
  return useQuery({
    queryKey: problemQueryKeys.single(slug),
    queryFn: async () => {
      // Guard against missing slug (should be prevented by enabled flag, but provides safety)
      if (!slug) {
        throw new Error('Problem slug is required')
      }

      // Fetch the problem details from the server
      const result = await getProblemBySlug(slug)

      // Throw typed error if the server request failed so React Query can handle it
      if (!result.isSuccess) {
        throw result.error
      }

      return result.value
    },
    // Only run the query when enabled and we have a valid slug
    enabled: enabled && slug !== null,
    // Individual problems change rarely, so we can cache them
    staleTime: CACHE_TIMING.staleTime,
    // Use global retry defaults (infinite retries) EXCEPT for 404 errors (permanent failures)
    retry: (_failureCount, error) => {
      // Don't retry if this is a "Problem not found" error (permanent failure)
      if (isProblemNotFoundError(error)) {
        return false
      }
      // Use global default: infinite retries with exponential backoff for transient errors
      return true
    },
  })
}

/**
 * Hook to fetch and paginate problem search results using infinite scroll.
 * Automatically handles caching, retries, and background updates.
 *
 * @param filters - The current filter state to search with
 * @param enabled - Whether the query should run (defaults to true when filters exist)
 */
function useProblemSearchInfinite(filters: SearchFiltersState | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: problemQueryKeys.search(filters),
    queryFn: async ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) => {
      // Guard against missing filters (should be prevented by enabled flag, but provides safety)
      if (!filters) {
        throw new Error('Filters are required for search')
      }

      // Fetch the page of problems from the server with abort support for request cancellation
      const result = await searchProblems(filters, DEFAULT_PAGE_SIZE, pageParam, signal)

      // Throw typed error if the server request failed so React Query can retry
      if (!result.isSuccess) {
        throw result.error
      }

      return result.value
    },
    // Start with page 1 (server uses 1-based pagination)
    initialPageParam: 1,

    // Determine the next page number based on current data
    getNextPageParam: (lastPage: FilterResponse) => {
      const { page, totalPages } = lastPage.problems
      // Return next page number if more pages exist, otherwise undefined to stop pagination
      return page < totalPages ? page + 1 : undefined
    },

    // Only run if filters are provided and enabled
    enabled: enabled && filters !== null,

    // Keep previous data while new query is loading to prevent filter options from flickering to base state
    placeholderData: (previousData) => previousData,

    // Retry with exponential backoff (inherited from QueryClient defaults)
    // Don't refetch on window focus for search results (user intent is to adjust filters, not auto-refresh)
    refetchOnWindowFocus: false,
  })
}

/**
 * Enhanced hook that wraps useProblemSearchInfinite with computed properties.
 * Provides a simpler API for components with all the data they need.
 * Transforms the infinite query structure into flat arrays and clear loading states.
 */
export function useProblemSearch(filters: SearchFiltersState | null, enabled = true) {
  const infiniteQuery = useProblemSearchInfinite(filters, enabled)

  // Flatten all pages into a single array of problems for easy rendering
  const problems = useMemo(() => {
    return infiniteQuery.data?.pages.flatMap((page) => page.problems.items) ?? []
  }, [infiniteQuery.data])

  // Get the most recent filter options (from the last page) to keep filter dropdowns in sync
  const filterOptions = useMemo(() => {
    const pages = infiniteQuery.data?.pages
    if (!pages || pages.length === 0) return null

    // Use last page because server updates options based on most recent filter state
    const lastPage = pages[pages.length - 1]
    return lastPage?.updatedOptions ?? null
  }, [infiniteQuery.data])

  // Get total count from the first page (stays constant across pagination)
  const totalCount = useMemo(() => {
    return infiniteQuery.data?.pages[0]?.problems.totalCount ?? 0
  }, [infiniteQuery.data])

  // Check if there are more pages to load for infinite scroll
  const hasMore = infiniteQuery.hasNextPage

  // Function to load the next page when user scrolls near the bottom
  const loadMore = useCallback(() => {
    // Guard against duplicate requests while already loading
    if (hasMore && !infiniteQuery.isFetchingNextPage) {
      infiniteQuery.fetchNextPage()
    }
  }, [hasMore, infiniteQuery])

  // Manual refetch function for retry scenarios (error states)
  const refetch = useCallback(() => {
    infiniteQuery.refetch()
  }, [infiniteQuery])

  return {
    // Data
    problems,
    filterOptions,
    totalCount,
    hasMore,

    // Loading states (distinguish between initial load, filter changes, and pagination)
    isLoading: infiniteQuery.isLoading,
    isSearching: infiniteQuery.isFetching && !infiniteQuery.isFetchingNextPage,
    isLoadingMore: infiniteQuery.isFetchingNextPage,

    // Error state
    error: infiniteQuery.error?.message ?? null,
    // Retry state - failureCount > 0 means we're retrying or have failed (show toast even between retries)
    isRetrying: infiniteQuery.failureCount > 0,
    // Timestamp of last successful data fetch (for detecting when new data arrives)
    dataUpdatedAt: infiniteQuery.dataUpdatedAt,

    // Actions
    loadMore,
    refetch,
  }
}
