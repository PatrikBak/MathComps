import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import { skipToken, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { unwrap } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'
import { useProblemStore } from '@/stores/problem-store'

import { DEFAULT_PAGE_SIZE } from '../constants/pagination-constants'
import { getProblemBySlug, searchProblems } from '../services/problem-service'
import type {
  FilterOptionsWithCounts,
  SearchFiltersState,
  SingleProblemResult,
} from '../types/problem-library-types'
import { countActiveFilters } from '../utils/filter-validation'

/**
 * The data shape returned by the infinite search query.
 */
export type ProblemSearchInfiniteData = {
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
  }
  /** The updated filter options based on the current search results. */
  updatedOptions: FilterOptionsWithCounts | null
  /** When filtering by a list, the display name of that list. Null otherwise. */
  listName: string | null
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
  /** The state of the fetch. */
  uiState: QueryUiState
  /** Runs the query again after it failed. */
  retry: () => void
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
  /** The state of the fetch. */
  uiState: QueryUiState
  /** Function to fetch the next page of results. */
  fetchNextPage: () => void
  /** Function to manually refetch the query. */
  refetch: () => void
}

/**
 * What one search names, beyond the prefix it shares with every other search.
 *
 * These ride in a single object rather than as loose positions, so a search sitting in the cache can
 * be read back by name. Positions would leave every reader having to know which slot each was
 * written at, which nothing checks and a reordering breaks in silence.
 */
type ProblemSearchKeySegment = {
  /** The language the search was sent in. */
  locale: string
  /** The filters it was sent under, null while the filter state has yet to settle. */
  filters: SearchFiltersState | null
  /** The reader it was sent for, null when nobody is signed in. */
  userId: string | null
}

/**
 * Query key factory for problem search queries.
 */
export const problemQueryKeys = {
  // Base key for all problem-related queries
  all: ['problems'] as const,

  // Key for every option the library offers, which nobody's own state moves
  baseOptions: (locale: string) => [...problemQueryKeys.all, 'base-options', locale] as const,

  // Prefix covering all search queries
  allSearches: () => [...problemQueryKeys.all, 'search'] as const,

  // Key for problem search results with specific filters + for the current user
  search: (locale: string, filters: SearchFiltersState | null, userId: string | null) =>
    [...problemQueryKeys.allSearches(), { locale, filters, userId }] as const,

  // Key for a single problem by slug
  single: (locale: string, problemSlug: string | null, userId: string | null) =>
    [...problemQueryKeys.all, 'single', locale, problemSlug, userId] as const,
}

/**
 * Reads what a search narrows to off the key it is cached under.
 *
 * Only {@link problemQueryKeys.search} builds a key shaped like this, and only searches ever reach
 * here: React Query matches the key a caller asked under before it runs their own predicate, so a
 * query of another kind is turned away first.
 *
 * @param queryKey - The key a search is held under.
 *
 * @returns The filters it was sent under, per {@link ProblemSearchKeySegment}.
 */
export function searchFiltersOf(queryKey: readonly unknown[]): SearchFiltersState | null {
  // The segment naming this search, which every search key ends with
  const segment = queryKey[queryKey.length - 1] as ProblemSearchKeySegment

  // What it narrows to
  return segment.filters
}

/**
 * Every option the library offers, which is where the search bar's rows come from.
 *
 * Nothing fetches these on their own: they ride along with the first answer the archive gives, and
 * whichever query receives them parks them here for the rest of the session. They are keyed by
 * language alone, since what the library holds is the same whoever is reading.
 *
 * @param locale - The current locale for localized metadata
 *
 * @returns The options, or undefined until the first answer has arrived
 */
export function useBaseOptions(locale: string): FilterOptionsWithCounts | undefined {
  // Read the entry the searches fill, re-rendering whenever one of them does. It has no fetcher of
  // its own, so it is kept for good: a search entry outliving it would be served from cache without
  // running the query that refills it, leaving the search bar with no rows to draw.
  const query = useQuery<FilterOptionsWithCounts>({
    queryKey: problemQueryKeys.baseOptions(locale),
    queryFn: skipToken,
    gcTime: Infinity,
  })

  // The options, absent until an answer has carried them
  return query.data
}

/**
 * Whether the library's options are worth asking for, which they are until one answer has carried
 * them, and again once what that answer carried has gone stale. An import is the only thing that
 * moves them, so they age on the same terms as the rest of the archive's content.
 *
 * @param queryClient - The cache the options are parked in.
 * @param locale - The current locale for localized metadata.
 *
 * @returns Whether to ask for them.
 */
function shouldAskForBaseOptions(queryClient: QueryClient, locale: string): boolean {
  // When the options were last written, absent while nothing has ever carried them
  const lastWritten = queryClient.getQueryState(problemQueryKeys.baseOptions(locale))?.dataUpdatedAt

  // Nothing holds them yet
  if (lastWritten === undefined) return true

  // What is held has gone stale, so an import since then would otherwise never be seen
  return Date.now() - lastWritten > cachePolicy.content.staleTime
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

  // The cache the library's own options are parked in
  const queryClient = useQueryClient()

  // Construct the React Query
  const query = useQuery({
    queryKey: problemQueryKeys.single(locale, problemSlug, userId),
    queryFn: async () => {
      // Guard against missing slug (should be prevented by enabled flag, but provides safety)
      if (!problemSlug) {
        throw new Error('Problem slug is required')
      }

      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // Fetch the problem details from the server, asking for the library's options only when the
      // reader arrived here cold rather than clicking through an archive that already holds them
      const data = unwrap(
        await getProblemBySlug(apiCall, problemSlug, shouldAskForBaseOptions(queryClient, locale))
      )

      // The library's options parked, so a reader arriving on a link has the search bar the archive
      // would have given them
      if (data.baseOptions) {
        queryClient.setQueryData(problemQueryKeys.baseOptions(locale), data.baseOptions)
      }

      // Sync to global store
      upsertProblem(data.problem)

      // Deconstruct the result to remove the problem
      const { problem: _, ...rest } = data

      // Return just the rest of the result (problem will be in the global store)
      return rest
    },
    // Only run the query when enabled and we have a valid slug
    enabled: enabled && problemSlug !== null && api.state === 'ready',
  })

  // Reduce the raw flags to the one state that describes this fetch
  const uiState = useQueryUiState(query)

  // Return just the data we need
  return {
    data: query.data,
    uiState,
    retry: query.refetch,
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

  // The cache the library's own options are parked in
  const queryClient = useQueryClient()

  // Construct the React Query
  const query = useInfiniteQuery({
    queryKey: problemQueryKeys.search(locale, filters, userId),
    queryFn: async ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) => {
      // Guard against missing filters (should be prevented by enabled flag, but provides safety)
      if (!filters) {
        throw new Error('Filters are required for search')
      }

      // Narrow to the ready caller
      const apiCall = readyApiCall(api)

      // Whether this search is the one to carry the library's options back. Only a first page can:
      // the archive counts them once per search and says nothing of them on the pages behind it.
      const askForBaseOptions = pageParam === 1 && shouldAskForBaseOptions(queryClient, locale)

      // Fetch the page of problems from the server with abort support for request cancellation
      const data = unwrap(
        await searchProblems(
          apiCall,
          filters,
          DEFAULT_PAGE_SIZE,
          pageParam,
          askForBaseOptions,
          signal
        )
      )

      // The library's options, lifted off the page they rode in on
      const { baseOptions, ...page } = data

      // An answer asked for the library's options and carrying none leaves the search bar nothing to
      // draw, so it is refused here rather than rendered as a page that never finishes loading
      if (askForBaseOptions && !baseOptions) {
        throw new Error('The archive answered the first search without the library options')
      }

      // The library's options parked for every later search to read, when this answer carried them
      if (baseOptions) {
        queryClient.setQueryData(problemQueryKeys.baseOptions(locale), baseOptions)
      }

      // Sync to global store
      upsertProblems(page.problems.items)

      // Separate the problems from the rest of the data so we can
      // just return the slugs (problems have been added to the global store)
      const { items: problems, ...rest } = page.problems

      // On the result, replace the problems with slugs
      return {
        ...page,
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
      // Derive whether more pages remain from the counts the backend sends
      const { page, pageSize, totalCount } = lastPage.problems

      // More pages remain while the items seen so far fall short of the total
      return page * pageSize < totalCount ? page + 1 : undefined
    },

    // Only run if filters are provided and enabled
    enabled: enabled && filters !== null && api.state === 'ready',
  })

  // Reduce the raw flags to the one state that describes this fetch
  const uiState = useQueryUiState(query)

  // Return just the data we need
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    uiState,
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
  /** The state of the fetch. */
  uiState: QueryUiState
  /** Runs the search again after it failed. */
  retry: () => void
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

  // The counts this search narrows to, which the archive sends with the first page alone since every
  // page behind it narrows to the very same set
  const filterOptions = useMemo(
    () => infiniteQuery.data?.pages[0]?.updatedOptions ?? null,
    [infiniteQuery.data]
  )

  // The counts of the last search that had any, kept so the sidebar has numbers to show while the
  // next search is still in flight
  const stableFilterOptionsRef = useRef<FilterOptionsWithCounts | null>(null)

  // Only update the ref if we have new filter options
  if (filterOptions) {
    stableFilterOptionsRef.current = filterOptions
  }
  // A search that narrows nothing is answered with no counts of its own, and holding on to an older
  // search's would show them beside the next set of filters entirely
  else if (infiniteQuery.data) {
    stableFilterOptionsRef.current = null
  }

  // A function which says whether a set of filters narrows nothing at all
  const isResetState = (filters: SearchFiltersState | null): boolean =>
    filters === null || countActiveFilters(filters) === 0

  // The counts the search bar shows. A search still in flight has none of its own yet, so the last
  // narrowing search's stand in and the numbers hold still while a filter is being refined. A search
  // that narrows nothing wants the whole library's, which the null here falls through to.
  const effectiveFilterOptions =
    filterOptions ?? (isResetState(filters) ? null : stableFilterOptionsRef.current)

  // How many problems this search matches in total, which the pages behind the first only repeat
  const totalCount = useMemo(
    () => infiniteQuery.data?.pages[0]?.problems.totalCount ?? 0,
    [infiniteQuery.data]
  )

  // The list being browsed, named once on the first page and the same on every page behind it
  const listName = useMemo(
    () => infiniteQuery.data?.pages[0]?.listName ?? null,
    [infiniteQuery.data]
  )

  // Check if there are more pages to load for infinite scroll
  const hasMore = infiniteQuery.hasNextPage

  // Function to load the next page when user scrolls near the bottom
  const loadMore = useCallback(() => {
    // Guard against duplicate requests while already loading. A page that failed also stops the
    // scroll from asking again, or every further scroll would spend a fresh burst of retries on a
    // backend that just turned all of them down; resuming takes an explicit ask.
    if (hasMore && !infiniteQuery.isFetchingNextPage && infiniteQuery.uiState.kind !== 'failed') {
      infiniteQuery.fetchNextPage()
    }
  }, [hasMore, infiniteQuery])

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

    // Fetch state
    uiState: infiniteQuery.uiState,

    // Actions
    retry: infiniteQuery.refetch,
    loadMore,
  }
}
