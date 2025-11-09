'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'

import { DEFAULT_PAGE_SIZE } from '../constants/pagination-constants'
import { CACHE_TIMING } from '../constants/timing-constants'
import { getInitialFilterData, getProblemBySlug, searchProblems } from '../services/problem-service'
import type { Problem } from '../types/problem-api-types'
import { isProblemNotFoundError } from '../types/problem-errors'
import type {
  FilterOptionsWithCounts,
  FilterResponse,
  SearchFiltersState,
} from '../types/problem-library-types'

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
 *
 * @param filters - The current filter state to search with
 * @param enabled - Whether the query should run
 */
function useProblemSearchInfinite(filters: SearchFiltersState | null, enabled: boolean) {
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

    // Don't refetch on window focus for search results (user intent is to adjust filters, not auto-refresh)
    refetchOnWindowFocus: false,
  })
}

/**
 * Enhanced hook that wraps useProblemSearchInfinite with computed properties.
 * Provides a simpler API for components with all the data they need.
 * Transforms the infinite query structure into flat arrays and clear loading states.
 */
export function useProblemSearchQuery(filters: SearchFiltersState | null, enabled: boolean) {
  const infiniteQuery = useProblemSearchInfinite(filters, enabled)

  // Store previous problems array for efficient comparison (order-dependent)
  const previousProblemsRef = useRef<Problem[]>([])

  // Flatten all pages into a single array of problems for easy rendering
  // Compare with previous problems to return same reference if contents and order are identical
  // Keep previous problems visible while searching to prevent flicker
  const problems = useMemo(() => {
    // Flatten the results from all pages
    const newProblems = infiniteQuery.data?.pages.flatMap((page) => page.problems.items) ?? []

    // Get the old currently visible problems
    const previousProblems = previousProblemsRef.current

    // If we're searching and have no new data yet, keep showing previous problems
    // This prevents the empty state flicker when filters change
    if (infiniteQuery.isFetching) {
      return previousProblems
    }

    // Compare lengths first
    if (
      newProblems.length === previousProblems.length &&
      // Otherwise we need order-dependent comparison: check if all problems are equal in order and slug
      newProblems.every((problem, index) => problem.slug === previousProblems[index]?.slug)
    ) {
      // Same problems (same slugs, same order), return previous reference to prevent re-render
      return previousProblems
    }

    // Problems changed (different slugs or order)...Update the problems
    previousProblemsRef.current = newProblems

    // The new problems will be displayed
    return newProblems
  }, [infiniteQuery.data, infiniteQuery.isFetching])

  // Get the most recent filter options (from the last page) to keep filter dropdowns in sync
  const filterOptions = useMemo(() => {
    const pages = infiniteQuery.data?.pages
    if (!pages || pages.length === 0) return null

    // Use last page because server updates options based on most recent filter state
    const lastPage = pages[pages.length - 1]
    return lastPage?.updatedOptions ?? null
  }, [infiniteQuery.data])

  // Keep previous filter options during loading so sidebar counts remain steady while new results load
  const stableFilterOptionsRef = useRef<FilterOptionsWithCounts | null>(null)
  // Track which filters produced the stable ref to detect stale data
  const stableFiltersRef = useRef<SearchFiltersState | null>(null)

  // Only update the ref if we have new filter options
  if (filterOptions) {
    stableFilterOptionsRef.current = filterOptions
    stableFiltersRef.current = filters
  }

  // Helper to check if filters represent a "reset" (empty/minimal state)
  const isResetState = (filters: SearchFiltersState | null): boolean => {
    if (!filters) return true
    return (
      filters.tags.length === 0 &&
      filters.authors.length === 0 &&
      filters.contestSelection.length === 0 &&
      filters.seasons.length === 0 &&
      filters.problemNumbers.length === 0 &&
      !filters.searchText
    )
  }

  // Helper to check if filters are "similar enough" to use stable ref
  // Similar = not a reset, and we're just refining filters (not a major change)
  const areFiltersSimilar = (
    current: SearchFiltersState | null,
    stable: SearchFiltersState | null
  ): boolean => {
    if (!current || !stable) return false
    // If current is a reset, they're not similar
    if (isResetState(current)) return false
    // If stable was a reset but current isn't, not similar
    if (isResetState(stable)) return false
    // Otherwise, consider them similar enough to prevent flicker during loading
    return true
  }

  // Check if we're using stale ref with mismatched filters
  const filtersMatchStable =
    filters && stableFiltersRef.current
      ? JSON.stringify(filters) === JSON.stringify(stableFiltersRef.current)
      : false
  const filtersAreSimilar = areFiltersSimilar(filters, stableFiltersRef.current)

  // Use the stable ref if:
  // 1. We have new filter options (use them)
  // 2. OR we're loading and filters match exactly (same query, just loading more)
  // 3. OR we're loading and filters are similar (refining, prevent flicker)
  // 4. Otherwise return null (forces fallback to baseOptions, especially on reset)
  const effectiveFilterOptions =
    filterOptions ??
    (filtersMatchStable || filtersAreSimilar ? stableFilterOptionsRef.current : null)

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

  // Determine if we're searching but have no data to show yet
  // Check the ref directly to avoid timing issues - if we have previous problems, we should show them
  // This prevents flicker when filters change (previous problems stay visible)
  const isSearchingWithNoData = useMemo(() => {
    const isSearching = infiniteQuery.isFetching && !infiniteQuery.isFetchingNextPage
    // Check the ref directly - if we have previous problems stored, we should show them, not skeleton
    // This ensures we don't show skeleton when filters change (previous problems are kept visible)
    const hasPreviousProblems = previousProblemsRef.current.length > 0
    // Only show skeleton if we're searching AND have no previous problems to show
    return isSearching && !hasPreviousProblems
  }, [infiniteQuery.isFetching, infiniteQuery.isFetchingNextPage])

  return {
    // Data
    problems,
    filterOptions: effectiveFilterOptions,
    totalCount,
    hasMore,

    // Loading states (distinguish between initial load, filter changes, and pagination)
    isLoading: infiniteQuery.isLoading,
    isSearching: infiniteQuery.isFetching && !infiniteQuery.isFetchingNextPage,
    isLoadingMore: infiniteQuery.isFetchingNextPage,
    // Indicates we're searching but have no data to show yet (should show skeleton)
    isSearchingWithNoData,

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
