'use client'

import { useAuth } from '@clerk/nextjs'
import { debounce, throttle } from 'lodash'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'
import { useProblemStore } from '@/stores/problem-store'

import type { FilterType } from '../components/SearchFilters'
import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { SEARCH_TIMING } from '../constants/timing-constants'
import {
  isNetworkError,
  isProblemNotFoundError,
  isServerError,
  isValidationError,
} from '../types/problem-errors'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import {
  needsLabelResolution,
  resolveContestSelectionLabels,
} from '../utils/contest-selection-resolver'
import { countActiveFilters } from '../utils/filter-validation'
import { isTextOnlyChange } from '../utils/search-logic'
import { serializeFilters } from '../utils/search-url-serialization'
import { createDefaultFilters } from '../utils/url-initialization'
import { getProblemsPageUrl, hasProblemId } from '../utils/url-utils'
import {
  useInitialFilterData,
  useProblemSearchQuery,
  useSingleProblem,
} from './use-problem-search-query'
import { useProblemUrlSync } from './use-problem-url-sync'

/**
 * Manages the UI-facing state of the search filters, separate from the state
 * used by React Query. This separation is crucial for a responsive user
 * experience. It allows the UI to update instantly when a user changes a
 * filter, while the actual data fetching (which can be debounced or throttled)
 * happens in the background.
 */
type OrchestratorState = {
  /**
   * The current, live state of the filters as displayed in the UI.
   * This is updated immediately on every user interaction to provide instant
   * feedback. It may not match the filters used for the most recent search query
   * while a debounced/throttled search is pending.
   */
  filters: SearchFiltersState | null

  /**
   * The initial state of the filters when the page loads.
   * This is typically derived from URL search parameters or a default state.
   * It's preserved to allow the user to reset the filters to their original
   * state.
   */
  initialFilters: SearchFiltersState | null

  /**
   * A gatekeeper flag to control when the `useProblemSearchQuery` is allowed to run.
   * This prevents the search from executing with empty or incomplete filters
   * during initial page load. It is set to `true` only after the initial filters
   * have been properly initialized from the URL or defaults.
   */
  shouldSearch: boolean
}

/**
 * Defines the set of actions that can be dispatched to modify the `OrchestratorState`.
 * Each action represents a specific, intentional state mutation.
 */
type OrchestratorAction =
  /** Sets the initial filter state upon page load. */
  | { type: 'SET_INITIAL_FILTERS'; payload: SearchFiltersState }
  /** Updates the filters in response to user input. */
  | { type: 'UPDATE_FILTERS'; payload: SearchFiltersState }
  /**
   * Updates only the contest selection part of the filters. This is used after
   * resolving human-readable labels for contest IDs that may have been loaded
   * from a URL.
   */
  | { type: 'SET_RESOLVED_SELECTIONS'; payload: SearchFiltersState['contestSelection'] }
  /** Enables the search query to run after initialization is complete. */
  | { type: 'ENABLE_SEARCH' }

/**
 * The reducer function responsible for handling state transitions for the search UI.
 * It takes the current state and an action, and returns the new state.
 *
 * @param state - The current `OrchestratorState`.
 * @param action - The `OrchestratorAction` to process.
 * @returns The new `OrchestratorState`.
 */
function orchestratorReducer(
  state: OrchestratorState,
  action: OrchestratorAction
): OrchestratorState {
  switch (action.type) {
    // Fired once on page load to establish the baseline filter state.
    case 'SET_INITIAL_FILTERS':
      return {
        ...state,
        // Both `filters` and `initialFilters` are set to the same payload.
        // `filters` drives the live UI.
        filters: action.payload,
        // `initialFilters` is stored for the "Reset" button functionality.
        initialFilters: action.payload,
      }

    // Fired every time the user changes a filter value.
    case 'UPDATE_FILTERS':
      return {
        ...state,
        // Updates the live UI filters. This provides immediate feedback.
        filters: action.payload,
      }

    // Fired after resolving labels for contest selections from the URL.
    case 'SET_RESOLVED_SELECTIONS':
      // Guard against running before filters are initialized.
      if (!state.filters) return state
      return {
        ...state,
        filters: {
          ...state.filters,
          // Merges the resolved contest selections into the existing filters,
          // preserving all other filter values.
          contestSelection: action.payload,
        },
      }

    // Fired after initial filters are set, allowing the search to proceed.
    case 'ENABLE_SEARCH':
      return {
        ...state,
        shouldSearch: true,
      }

    default:
      return state
  }
}

/**
 * The return type of the `useProblemSearch` hook.
 * Encapsulates the entire state and actions available for the problem search feature.
 */
type UseProblemSearchReturn = {
  /**
   * The current state of the problem search, including loading status, filters, and data.
   */
  state: {
    /** Whether the initial data or search results are currently loading. */
    isLoading: boolean
    /** Whether a search is happening in the background (e.g., while typing or filtering). */
    isSearchingInBackground: boolean
    /** Whether more results are being loaded (infinite scroll). */
    isLoadingMore: boolean
    /** Whether a search is in progress but no data is available to show yet. */
    isSearchingWithNoData: boolean
    /** Whether the initial filter options and configuration have been loaded. */
    hasInitialDataLoaded: boolean

    /** The current active filters driving the UI. */
    filters: SearchFiltersState | null
    /** The initial filters set on page load (used for reset functionality). */
    initialFilters: SearchFiltersState | null
    /** The available options for filtering. */
    filterOptions: FilterOptionsWithCounts | null
    /** The base filter options loaded initially (without search adjustments). */
    baseOptions: FilterOptionsWithCounts | null

    /** The list of problem slugs currently displayed. */
    problems: string[]
    /** The total number of problems matching the current criteria. */
    totalCount: number
    /** Whether there are more pages of results available. */
    hasMore: boolean
    /** The current page number (always 1 in this infinite scroll implementation). */
    currentPage: number

    /** Error message if the search or initial load failed. */
    error: string | null
  }
  /**
   * Handler for updating the search filters.
   *
   * @param newFilters The new state of the filters.
   * @param type Optional type of change ('discrete' or 'text') to optimize search timing.
   */
  handleFiltersChange: (newFilters: SearchFiltersState, type?: FilterType) => void
  /**
   * Handler to load more results (infinite scroll).
   */
  loadMore: () => void
}

/**
 * The primary hook for managing all problem search functionality.
 * Uses TanStack Query for data fetching, caching, and retries.
 * Maintains a reducer for immediate UI state updates.
 *
 * @returns An object containing the complete search state and handler functions.
 */
export const useProblemSearch = (): UseProblemSearchReturn => {
  // Initialize UI state using our reducer
  const [uiState, dispatch] = useReducer(orchestratorReducer, {
    filters: null,
    initialFilters: null,
    shouldSearch: false,
  })

  // Check if we're viewing a single problem by ID
  const router = useRouter()
  const searchParams = useSearchParams()
  const problemId = hasProblemId(searchParams) ? searchParams.get('id') : null

  // Get the current user
  const { userId, isLoaded: isUserDataLoaded } = useAuth()

  // Get the user ID which is either string or null...We will lose the
  // information that the user is not loaded, but this will be re-used
  // by passing whether a query is enabled or not...
  const safeUserId = isUserDataLoaded ? (userId ?? null) : null

  // Fetch initial filter options
  // Only fetch when auth is loaded to ensure we have the correct user context (for likes)
  // Type assertion: when isLoaded is true, userId is guaranteed to be string | null (never undefined)
  const initialDataQuery = useInitialFilterData(safeUserId, isUserDataLoaded)

  // Track the query filters separately from UI filters
  // This prevents React Query from creating cache entries for every keystroke
  const [queryFilters, setQueryFilters] = useState<SearchFiltersState | null>(null)

  // Fetch single problem if ID is in URL
  // Type assertion: when isLoaded is true, userId is guaranteed to be string | null (never undefined)
  const singleProblemQuery = useSingleProblem(
    problemId,
    safeUserId,
    !!problemId && isUserDataLoaded
  )

  // Search for problems based on current filters (disabled if viewing single problem)
  // Use queryFilters (not uiState.filters) to prevent React Query cache pollution from every keystroke
  // Type assertion: when isLoaded is true, userId is guaranteed to be string | null (never undefined)
  const searchQuery = useProblemSearchQuery(
    queryFilters,
    safeUserId,
    !problemId && uiState.shouldSearch && !initialDataQuery.isLoading && isUserDataLoaded
  )

  // Store the filters in a ref for debounced/throttled functions
  const filtersRef = useRef<SearchFiltersState | null>(null)
  filtersRef.current = uiState.filters

  // Track whether we've triggered the initial search
  const hasTriggeredInitialSearch = useRef(false)

  // Sync filters to the global store so other components can access them
  // Must be in useEffect to avoid setState during render
  useEffect(() => {
    useProblemStore.getState().setCurrentFilters(uiState.filters)
  }, [uiState.filters])

  // Effect to initialize filters when initial data loads
  useEffect(() => {
    if (initialDataQuery.data && !uiState.initialFilters) {
      const emptyFilters = createDefaultFilters()
      dispatch({ type: 'SET_INITIAL_FILTERS', payload: emptyFilters })
      // Initialize query filters to match
      setQueryFilters(emptyFilters)
      // Trigger initial search after filters are set
      dispatch({ type: 'ENABLE_SEARCH' })
    }
  }, [initialDataQuery.data, uiState.initialFilters])

  // Effect to handle single problem view
  useEffect(() => {
    if (singleProblemQuery.data && problemId) {
      // When viewing a single problem, ensure initialFilters are set to defaults first
      // This ensures the reset button always resets to empty filters, not problem-specific ones
      if (!uiState.initialFilters) {
        const defaultFilters = createDefaultFilters()
        dispatch({ type: 'SET_INITIAL_FILTERS', payload: defaultFilters })
      }

      // Update current filters to match the single problem's context
      const problemFilters = singleProblemQuery.data.filters
      dispatch({ type: 'UPDATE_FILTERS', payload: problemFilters })
      // Also update query filters for consistency
      setQueryFilters(problemFilters)
    }
  }, [singleProblemQuery.data, problemId, uiState.initialFilters])

  // Effect to handle errors when fetching a single problem by ID
  useEffect(() => {
    // Nothing to handle if we don't have an error or a problem ID
    if (!singleProblemQuery.error || !problemId) {
      return
    }

    // We have an error if we got here
    const error = singleProblemQuery.error
    const isFirstError = singleProblemQuery.failureCount === 1
    const isRetrying = singleProblemQuery.isFetching

    // Truncate problem ID to prevent XSS or UI breaking with malicious/long inputs
    const maxProblemIdLength = 20
    const truncatedProblemId =
      problemId && problemId.length > maxProblemIdLength
        ? `${problemId.slice(0, maxProblemIdLength)}...`
        : problemId

    // Handle different error types with appropriate user feedback
    if (isProblemNotFoundError(error)) {
      // Problem doesn't exist - redirect to all problems (no retries)
      // Only show toast once, not on every effect re-run
      if (!isRetrying) {
        toast.error(`Úloha "${truncatedProblemId}" nebola nájdená`)
        router.replace(ROUTES.PROBLEMS, { scroll: false })
      }
    } else if (isNetworkError(error) && isFirstError) {
      // Network issues - show toast only on first failure, then retry silently
      toast.error('Problém s pripojením. Skúšam znova...')
    } else if (isServerError(error) && isFirstError) {
      // Server error - show toast only on first failure, then retry silently
      toast.error('Server vrátil chybu. Skúšam znova...')
    } else if (isValidationError(error)) {
      // Invalid request parameters - shouldn't happen in normal flow (no retries)
      // Only show toast once, not on every effect re-run
      if (!isRetrying) {
        toast.error('Neplatné parametre požiadavky')
        router.replace(ROUTES.PROBLEMS, { scroll: false })
      }
    } else if (isFirstError) {
      // Unknown error type - generic fallback (show only on first failure)
      toast.error('Nastala neočakávaná chyba. Skúšam znova...')
    }
  }, [
    problemId,
    singleProblemQuery.error,
    singleProblemQuery.isFetching,
    singleProblemQuery.failureCount,
    router,
  ])

  // Callback to trigger search (used by debounced/throttled functions)
  const triggerSearch = useCallback(() => {
    // Update query filters to match current UI filters
    // This is the only place where we update the React Query cache key
    if (filtersRef.current) {
      setQueryFilters(filtersRef.current)
    }

    if (!hasTriggeredInitialSearch.current) {
      hasTriggeredInitialSearch.current = true
      dispatch({ type: 'ENABLE_SEARCH' })
    }
  }, [])

  // Rate-limited search functions for different filter types
  const throttledSearch = useMemo(
    () => throttle(triggerSearch, SEARCH_TIMING.throttleMs, { leading: true, trailing: true }),
    [triggerSearch]
  )

  const debouncedTextSearch = useMemo(
    () => debounce(triggerSearch, SEARCH_TIMING.textDebounceMs),
    [triggerSearch]
  )

  // Debounced URL update - keeps URL in sync with filters without URL spam
  const debouncedUrlUpdate = useMemo(
    () =>
      debounce((filters: SearchFiltersState) => {
        const queryString = serializeFilters(filters)
        const url = getProblemsPageUrl(queryString)
        router.replace(url, { scroll: false })
      }, SEARCH_TIMING.urlDebounceMs),
    [router]
  )

  // The main function exposed to the UI for handling filter changes
  const handleFiltersChange = useCallback(
    (newFilters: SearchFiltersState, type?: 'discrete' | 'text') => {
      // Validate filter count to prevent excessive URL length and maintain performance
      const filterCount = countActiveFilters(newFilters)
      if (filterCount > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
        toast.warning(`Môžete vybrať maximálne ${ACTIVE_FILTERS_CONSTANTS.maxFilterLimit} filtrov`)
        return
      }

      // If we're viewing a single problem and user changes filters, exit single problem view
      if (problemId) {
        // Clear the ?id parameter from URL to enable search
        router.replace(ROUTES.PROBLEMS, { scroll: false })
      }

      // Capture the old filter values before updating (needed for change detection)
      const previousFilters = filtersRef.current

      // Always update UI state immediately for responsive feedback
      dispatch({ type: 'UPDATE_FILTERS', payload: newFilters })

      // Update the ref immediately so throttled/debounced functions use the new filters
      // This must happen before calling search functions to avoid stale data
      filtersRef.current = newFilters

      // Update URL to match current filters (debounced to avoid excessive URL bar updates)
      debouncedUrlUpdate(newFilters)

      // Decide which search strategy to use based on change type
      // Use explicit type if provided, otherwise infer from filter comparison
      const isTextChange =
        type === 'text' ||
        (!type && previousFilters && isTextOnlyChange(previousFilters, newFilters))

      if (isTextChange) {
        // For text changes: debounce the query execution
        // The queryFilters state will only update after debounce completes
        debouncedTextSearch()
      } else {
        // For discrete changes: throttle the query execution
        throttledSearch()
      }
    },
    [debouncedTextSearch, throttledSearch, debouncedUrlUpdate, problemId, router]
  )

  // Effect to resolve human-readable labels for filter selections
  useEffect(() => {
    if (!uiState.filters || !initialDataQuery.data?.updatedOptions) return

    if (
      needsLabelResolution(uiState.filters.contestSelection, initialDataQuery.data.updatedOptions)
    ) {
      const resolvedSelections = resolveContestSelectionLabels(
        uiState.filters.contestSelection,
        initialDataQuery.data.updatedOptions
      )

      dispatch({
        type: 'SET_RESOLVED_SELECTIONS',
        payload: resolvedSelections,
      })
    }
  }, [initialDataQuery.data?.updatedOptions, uiState.filters])

  // Cleanup debounced/throttled functions on unmount
  useEffect(() => {
    return () => {
      debouncedTextSearch.cancel()
      throttledSearch.cancel()
      debouncedUrlUpdate.cancel()
    }
  }, [debouncedTextSearch, throttledSearch, debouncedUrlUpdate])

  // Effect to show retry toast when network requests are failing
  // Uses React's cleanup mechanism: toast is dismissed when dependencies change
  useEffect(() => {
    const shouldShowToast = !problemId && initialDataQuery.isSuccess && searchQuery.isRetrying

    if (shouldShowToast) {
      // Show persistent toast when retrying
      const toastId = toast.loading('Strata spojenia, skúšame obnoviť', {
        duration: Infinity,
      })

      // Cleanup function runs when dependencies change OR on unmount
      // This is the key: React dismisses the toast automatically when retrying stops
      return () => {
        toast.dismiss(toastId)
      }
    }
  }, [problemId, initialDataQuery.isSuccess, searchQuery.isRetrying])

  // Instantiate the URL synchronization hook
  useProblemUrlSync({
    filters: uiState.filters,
    baseOptions: initialDataQuery.data?.updatedOptions ?? null,
    handleFiltersChange,
    isLoaded: isUserDataLoaded,
    isSignedIn: !!userId,
  })

  // Get the final filter options.
  // Now a weird bunch of hacks come which should prevent random hard-to-trace race
  // conditions. One day I'd like to learn how a pretty code of this entire thing
  // would look like and work because this has turned into something real sus....

  // Check if UI filters match the query filters that produced the cached results
  // If they don't match, we're in a transition state and shouldn't show stale counts
  const filtersMatchQuery = JSON.stringify(uiState.filters) === JSON.stringify(queryFilters)

  // Additional safety: if we're searching with different filters, don't trust cached data
  // This catches the case where queryFilters hasn't updated yet but search is still running
  const isSearchingWithMismatchedFilters = searchQuery.isSearching && !filtersMatchQuery

  // The options with adjusted counts after filtering (e.g. by text)
  // Only use searchQuery.filterOptions if filters match to avoid showing stale cached counts
  // Also don't use it if we're searching with mismatched filters (transition state)
  const filterOptions =
    // Case 1: Viewing a single problem by ID (URL has ?id=slug)
    // Happens when user navigates to a specific problem page
    singleProblemQuery.data?.options ??
    // Case 2: Normal search results with matching filters
    // Happens when: filters match queryFilters AND we're not in a transition state
    // This is the happy path - user has applied filters, search completed, counts are accurate
    (filtersMatchQuery && !isSearchingWithMismatchedFilters ? searchQuery.filterOptions : null) ??
    // Case 3: Base options fallback (initial state, reset, or during filter transitions)
    // Happens when:
    //   - Initial page load (before first search completes)
    //   - User clicks "Reset" (filters cleared, waiting for new search)
    //   - Filter transition state (filters changed but query hasn't updated yet)
    //   - Any time we can't trust searchQuery.filterOptions (prevents stale counts)
    initialDataQuery.data?.updatedOptions ??
    // Case 4: No data available yet
    // Happens only during very early mount, before initialDataQuery completes
    // Should be rare - initialDataQuery loads quickly on page load
    null

  // The options we stared with
  const baseOptions = initialDataQuery.data?.updatedOptions ?? null

  // Determine overall loading state
  // For single problem queries, treat error states (except when retrying) as not loading
  const isLoading = problemId
    ? singleProblemQuery.isLoading && !singleProblemQuery.error
    : initialDataQuery.isLoading
  const hasInitialDataLoaded = initialDataQuery.isSuccess

  // Get displayed problems from the global store
  const displayedProblems = useProblemStore((state) => state.displayedProblems)

  // Determine problem data source (single problem vs search results)
  // Use displayedProblems from the global store instead of searchQuery.problems
  // This enables optimistic updates (e.g. removing a problem from the list when unliking)
  const problems = problemId ? [problemId] : displayedProblems
  const totalCount = problemId ? 1 : searchQuery.totalCount
  const hasMore = problemId ? false : searchQuery.hasMore

  // Always track if we're searching in the background (for subtle UI indicators like count spinner)
  // This is used to prevent loadMore/prefetch during searches and show spinner in count
  const isSearchingInBackground = !problemId && searchQuery.isSearching

  // Track if we're searching but have no data to show yet (should show skeleton, not empty state)
  // This is only relevant for search queries, not single problem views
  const isSearchingWithNoData = !problemId && searchQuery.isSearchingWithNoData

  // Put together the final result
  return {
    state: {
      // Loading states
      isLoading,
      isSearchingInBackground,
      isLoadingMore: !problemId && searchQuery.isLoadingMore,
      isSearchingWithNoData,
      hasInitialDataLoaded,

      // Filter state
      filters: uiState.filters,
      initialFilters: uiState.initialFilters,
      filterOptions,
      baseOptions,

      // Problem data
      problems,
      totalCount,
      hasMore,
      currentPage: 1,

      // Error state - show error message while initial load is retrying
      // With infinite retries, React Query never sets error, so we detect retrying via failureCount
      error: initialDataQuery.isRetrying ? 'Nepodarilo sa pripojiť na server' : null,
    },
    handleFiltersChange,
    loadMore: searchQuery.loadMore,
  }
}
