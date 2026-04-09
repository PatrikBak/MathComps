import type { InfiniteData } from '@tanstack/react-query'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useApi } from '@/hooks/use-api'
import { useProblemStore } from '@/stores/problem-store'

import { DEFAULT_PAGE_SIZE } from '../constants/pagination-constants'
import { CACHE_TIMING } from '../constants/timing-constants'
import { getInitialFilterData, getProblemBySlug, searchProblems } from '../services/problem-service'
import {
  isListAccessDeniedError,
  isListNotFoundError,
  isProblemNotFoundError,
} from '../types/problem-errors'
import type {
  FilterOptionsWithCounts,
  SearchFiltersState,
  SingleProblemResult,
} from '../types/problem-library-types'

/**
 * The data shape returned by the infinite search query.
 */
type ProblemSearchInfiniteData = {
  /** The problem data for the current page. */
  problems: {
    /** The list of problem slugs on this page. */
    slugs: string[]
    /** The current page number. */
    page: number
    /** The number of items per page. */
    pageSize: number
    /** The total number of problems matching the search criteria. */
    totalCount: number
    /** The total number of pages available. */
    totalPages: number
  }
  /** The updated filter options based on the current search results. */
  updatedOptions: FilterOptionsWithCounts | null
  /** When filtering by a list, the display name of that list. Null otherwise. */
  listName: string | null
}

/**
 * The return type of the `useInitialFilterData` hook.
 */
type UseInitialFilterDataReturn = {
  /** The data returned by the query (initial filter options and first batch of problems). */
  data: ProblemSearchInfiniteData | undefined
  /** Whether the query is currently loading. */
  isLoading: boolean
  /** Whether the query was successful. */
  isSuccess: boolean
  /** Whether the query is currently retrying after a failure. */
  isRetrying: boolean
}

/**
 * The return type of the `useSingleProblem` hook.
 */
type UseSingleProblemReturn = {
  /**
   * The data returned by the query (filters and options),
   * excluding the problem itself (to be accessed from the global store).
   */
  data: Omit<SingleProblemResult, 'problem'> | undefined
  /** Whether the query is currently loading (initial fetch). */
  isLoading: boolean
  /** Whether the query is currently fetching (initial or background). */
  isFetching: boolean
  /** Whether the query encountered an error. */
  isError: boolean
  /** The error object if the query failed. */
  error: Error | null
  /** The number of consecutive failures. */
  failureCount: number
}

/**
 * The return type of the `useProblemSearchInfinite` hook.
 */
type UseProblemSearchInfiniteReturn = {
  /** The infinite data structure containing pages of results. */
  data: InfiniteData<ProblemSearchInfiniteData> | undefined
  /** Whether the query is currently loading (initial fetch). */
  isLoading: boolean
  /** Whether the query is currently fetching (initial or background). */
  isFetching: boolean
  /** Whether the next page is currently being fetched. */
  isFetchingNextPage: boolean
  /** Whether there are more pages available to fetch. */
  hasNextPage: boolean
  /** The error object if the query failed. */
  error: Error | null
  /** The number of consecutive failures. */
  failureCount: number
  /** The timestamp of the last successful data update. */
  dataUpdatedAt: number
  /** Function to fetch the next page of results. */
  fetchNextPage: () => void
  /** Function to manually refetch the query. */
  refetch: () => void
}

/**
 * Query key factory for problem search queries.
 */
export const problemQueryKeys = {
  // Base key for all problem-related queries
  all: ['problems'] as const,

  // Key for initial filter data (all available options)
  initialData: (locale: string, userId: string | null) =>
    [...problemQueryKeys.all, 'initial', locale, userId] as const,

  // Prefix covering all search queries
  allSearches: () => [...problemQueryKeys.all, 'search'] as const,

  // Key for problem search results with specific filters + for the current user
  search: (locale: string, filters: SearchFiltersState | null, userId: string | null) =>
    [...problemQueryKeys.allSearches(), locale, filters, userId] as const,

  // Key for a single problem by slug
  single: (locale: string, problemSlug: string | null, userId: string | null) =>
    [...problemQueryKeys.all, 'single', locale, problemSlug, userId] as const,
}

/**
 * Hook to fetch initial filter data, i.e. filter options + the first batch of problems
 * Used during the initial page load to populate filter dropdowns.
 *
 * @param locale - The current locale for localized metadata
 * @param userId - The current user's ID (or null if anonymous)
 * @param enabled - Whether the query should run
 *
 * @returns The query result containing initial filter options
 */
export function useInitialFilterData(
  locale: string,
  userId: string | null,
  enabled: boolean
): UseInitialFilterDataReturn {
  // Get the API caller
  const api = useApi({ requireAuth: false })

  // Get the function to update problems in the global store
  const upsertProblems = useProblemStore((state) => state.upsertProblems)

  // Construct the React Query
  const query = useQuery({
    queryKey: problemQueryKeys.initialData(locale, userId),
    queryFn: async () => {
      // Guard against missing API caller (should be prevented by enabled flag)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Fetch the initial filter options from the server
      const result = await getInitialFilterData(api.apiCall)

      // Throw typed error if the server request failed so React Query can retry
      if (!result.success) {
        throw result.error
      }

      // Ensure we received valid filter options before proceeding
      if (!result.data.updatedOptions) {
        throw new Error('No filter options received from server')
      }

      // Sync problems to global store
      upsertProblems(result.data.problems.items)

      // Destructure to separate 'items' from the rest of the data
      const { items, ...problemMetadata } = result.data.problems

      // Return structure with 'slugs' instead of 'items'
      return {
        ...result.data,
        problems: {
          ...problemMetadata,
          slugs: items.map((problem) => problem.slug),
        },
      }
    },
    // Initial data rarely changes, so we can cache it aggressively
    staleTime: CACHE_TIMING.staleTime,
    gcTime: CACHE_TIMING.gcTime,
    enabled: enabled && api.state === 'ready',
  })

  // Return only the data we need
  return {
    data: query.data,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    // Expose retry state - failureCount > 0 means we're retrying after failure
    isRetrying: query.failureCount > 0,
  }
}

/**
 * Hook to fetch a single problem by its slug.
 * Used when the URL contains an `id` parameter pointing to a specific problem.
 *
 * @param locale - The current locale for localized metadata
 * @param problemSlug - The problem slug from the URL (null if not viewing a single problem)
 * @param userId - The current user's ID (or null if anonymous)
 * @param enabled - Whether the query should run
 *
 * @returns The query result containing the single problem data
 */
export function useSingleProblem(
  locale: string,
  problemSlug: string | null,
  userId: string | null,
  enabled: boolean
): UseSingleProblemReturn {
  // Get the API caller
  const api = useApi({ requireAuth: false })

  // Get the function to update a single problem in the global store
  const upsertProblem = useProblemStore((state) => state.upsertProblem)

  // Construct the React Query
  const query = useQuery({
    queryKey: problemQueryKeys.single(locale, problemSlug, userId),
    queryFn: async () => {
      // Guard against missing slug (should be prevented by enabled flag, but provides safety)
      if (!problemSlug) {
        throw new Error('Problem slug is required')
      }

      // Guard against missing API caller (should be prevented by enabled flag, but provides safety)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Fetch the problem details from the server
      const result = await getProblemBySlug(api.apiCall, problemSlug)

      // Throw typed error if the server request failed so React Query can handle it
      if (!result.success) {
        throw result.error
      }

      // Sync to global store
      upsertProblem(result.data.problem)

      // Deconstruct the result to remove the problem
      const { problem: _, ...rest } = result.data

      // Return just the rest of the result (problem will be in the global store)
      return rest
    },
    // Only run the query when enabled and we have a valid slug
    enabled: enabled && problemSlug !== null && api.state === 'ready',
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

  // Return just the data we need
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    failureCount: query.failureCount,
  }
}

/**
 * Internal hook to fetch and paginate problem search results using infinite scroll.
 *
 * @param locale - The current locale for localized metadata
 * @param filters - The current filter state to search with (null if not yet initialized)
 * @param userId - The current user's ID (or null if anonymous)
 * @param enabled - Whether the query should run
 *
 * @returns The query result containing the search results
 */
function useProblemSearchInfinite(
  locale: string,
  filters: SearchFiltersState | null,
  userId: string | null,
  enabled: boolean
): UseProblemSearchInfiniteReturn {
  // Get the API caller
  const api = useApi({ requireAuth: false })

  // Get the function to update problems in the global store
  const upsertProblems = useProblemStore((state) => state.upsertProblems)

  // Construct the React Query
  const query = useInfiniteQuery({
    queryKey: problemQueryKeys.search(locale, filters, userId),
    queryFn: async ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) => {
      // Guard against missing filters (should be prevented by enabled flag, but provides safety)
      if (!filters) {
        throw new Error('Filters are required for search')
      }

      // Guard against missing API caller (should be prevented by enabled flag, but provides safety)
      if (api.state !== 'ready') throw new Error('API not ready')

      // Fetch the page of problems from the server with abort support for request cancellation
      const result = await searchProblems(
        api.apiCall,
        filters,
        DEFAULT_PAGE_SIZE,
        pageParam,
        signal
      )

      // Throw typed error if the server request failed so React Query can retry
      if (!result.success) {
        throw result.error
      }

      // Sync to global store
      upsertProblems(result.data.problems.items)

      // Separate the problems from the rest of the data so we can
      // just return the slugs (problems have been added to the global store)
      const { items: problems, ...rest } = result.data.problems

      // On the result, replace the problems with slugs
      return {
        ...result.data,
        problems: {
          ...rest,
          slugs: problems.map((problem) => problem.slug),
        },
      }
    },
    // Start with page 1 (server uses 1-based pagination)
    initialPageParam: 1,

    // Determine the next page number based on current data
    getNextPageParam: (lastPage) => {
      // Get the problem slugs from the last page
      const { page, totalPages } = lastPage.problems

      // Return next page number if more pages exist, otherwise undefined to stop pagination
      return page < totalPages ? page + 1 : undefined
    },

    // Only run if filters are provided and enabled
    enabled: enabled && filters !== null && api.state === 'ready',

    // Don't refetch on window focus for search results (user intent is to adjust filters, not auto-refresh)
    refetchOnWindowFocus: false,

    // Stop retrying on permanent list access errors
    retry: (_failureCount, error) => {
      if (isListNotFoundError(error) || isListAccessDeniedError(error)) {
        return false
      }
      // If not a list error, use global default for retries
      return true
    },
  })

  // Return just the data we need
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    error: query.error,
    failureCount: query.failureCount,
    dataUpdatedAt: query.dataUpdatedAt,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  }
}

/**
 * The return type of the {@link useProblemSearchQuery} hook.
 */
type UseProblemSearchQueryReturn = {
  /** The list of problem slugs to display. */
  problems: string[]
  /** The available filter options (counts adjusted based on search). */
  filterOptions: FilterOptionsWithCounts | null
  /** The total count of problems matching the search. */
  totalCount: number
  /** Whether there are more pages available to load. */
  hasMore: boolean
  /** True ONLY when a query is loading and there is zero cached data. This typically happens when the user clicks a totally new filter combination. */
  isPending: boolean
  /** True anytime a network request is currently active (excluding pagination). This includes both initial loads, filter changes, and background invalidation syncs. */
  isFetching: boolean
  /** True only when scrolling and infinite-fetching the subsequent page. */
  isFetchingNextPage: boolean
  /** When filtering by a list, the display name of that list. Null otherwise. */
  listName: string | null
  /** The error message if the search failed. */
  error: string | null
  /** The raw typed error object for type guard inspection (e.g. list access errors). */
  rawError: Error | null
  /** Whether the search is currently retrying after a failure. */
  isRetrying: boolean
  /** Function to load the next page of results. */
  loadMore: () => void
}

/**
 * Enhanced hook that wraps {@link useProblemSearchInfinite} with computed properties.
 * Provides a simpler API for components with all the data they need.
 * Transforms the infinite query structure into flat arrays and clear loading states.
 *
 * @param locale - The current locale for localized metadata
 * @param filters - The current filter state to search with (null if not yet initialized)
 * @param userId - The current user's ID (or null if anonymous)
 * @param enabled - Whether the query should run
 *
 * @returns The query result containing the search results
 */
export function useProblemSearchQuery(
  locale: string,
  filters: SearchFiltersState | null,
  userId: string | null,
  enabled: boolean
): UseProblemSearchQueryReturn {
  // Construct the infinite query
  const infiniteQuery = useProblemSearchInfinite(locale, filters, userId, enabled)

  // Get the function to update displayed problems
  const setDisplayedProblems = useProblemStore((state) => state.setDisplayedProblems)

  // Store previous problems array. We will use it to determine whether
  // we have fetched / obtained from cache the same problems as before.
  // If yes, we can then return the old problem array reference and avoid
  // unnecessary re-renders of components that use the problems array.
  const previousProblemsRef = useRef<string[]>([])

  // The problems to display
  const finalProblems = useMemo(() => {
    // Flatten the results from all pages
    const newProblems = infiniteQuery.data?.pages.flatMap((page) => page.problems.slugs) ?? []

    // Get the old currently visible problems
    const previousProblems = previousProblemsRef.current

    // Here we need to figure out if there was a change in the problems
    if (
      // First compare lengths
      newProblems.length === previousProblems.length &&
      // Otherwise we need order-dependent comparison: check if all problems are equal in order and slug
      newProblems.every((slug, index) => slug === previousProblems[index])
    ) {
      // Same problems (same slugs, same order), return previous reference to prevent re-render
      return previousProblems
    }

    // Problems changed (different slugs or order)...Update the problems
    previousProblemsRef.current = newProblems

    // The new problems will be displayed
    return newProblems
  }, [infiniteQuery.data?.pages])

  // Sync problems to the global store
  useEffect(() => {
    setDisplayedProblems(finalProblems)
  }, [finalProblems, setDisplayedProblems])

  // Get the most recent filter options (from the last page) to keep filter dropdowns in sync
  const filterOptions = useMemo(() => {
    // Ensure we even have any data
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
    // If either is null, they're not similar
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

  // Get list name from the first page (consistent across all pages for the same list)
  const listName = useMemo(() => {
    return infiniteQuery.data?.pages[0]?.listName ?? null
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

  // Compose the final result object
  return {
    // Data
    problems: finalProblems,
    filterOptions: effectiveFilterOptions,
    totalCount,
    hasMore,
    listName,

    // Loading states mapped to strict React Query terminology
    isPending: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching && !infiniteQuery.isFetchingNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,

    // Error state
    error: infiniteQuery.error?.message ?? null,
    // Raw typed error for type guard inspection (list access errors, etc.)
    rawError: infiniteQuery.error,
    // Retry state - failureCount > 0 means we're retrying or have failed (show toast even between retries)
    isRetrying: infiniteQuery.failureCount > 0,

    // Actions
    loadMore,
  }
}
