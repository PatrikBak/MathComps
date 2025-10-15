'use client'

import { debounce, throttle } from 'lodash'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import { SEARCH_TIMING } from '../constants/timing-constants'
import {
  isNetworkError,
  isProblemNotFoundError,
  isServerError,
  isValidationError,
} from '../types/problem-errors'
import type { SearchFiltersState } from '../types/problem-library-types'
import {
  needsLabelResolution,
  resolveContestSelectionLabels,
} from '../utils/contest-selection-resolver'
import { isTextOnlyChange } from '../utils/search-logic'
import { serializeFilters } from '../utils/search-url-serialization'
import { createDefaultFilters } from '../utils/url-initialization'
import { hasProblemId } from '../utils/url-problem-resolver'
import { getProblemsPageUrl } from '../utils/url-utils'
import {
  useInitialFilterData,
  useProblemSearch as useProblemSearchQuery,
  useSingleProblem,
} from './use-problem-search-query'
import { useProblemUrlSync } from './use-problem-url-sync'

/**
 * UI state managed by this hook (separate from React Query state).
 * This handles immediate UI updates for filters before queries execute.
 */
type OrchestratorState = {
  // Current filter values (updated immediately for responsive UI)
  filters: SearchFiltersState | null
  // Initial filters on page load (for URL initialization)
  initialFilters: SearchFiltersState | null
  // Controls when React Query search is allowed to run.
  // Prevents search from firing before filters are initialized (would search with null filters).
  // Becomes true after: (1) initial filter setup, or (2) user changes any filter.
  shouldSearch: boolean
}

type OrchestratorAction =
  | { type: 'SET_INITIAL_FILTERS'; payload: SearchFiltersState }
  | { type: 'UPDATE_FILTERS'; payload: SearchFiltersState }
  | { type: 'SET_RESOLVED_SELECTIONS'; payload: SearchFiltersState['contestSelection'] }
  | { type: 'ENABLE_SEARCH' }

const initialState: OrchestratorState = {
  filters: null,
  initialFilters: null,
  shouldSearch: false,
}

function orchestratorReducer(
  state: OrchestratorState,
  action: OrchestratorAction
): OrchestratorState {
  switch (action.type) {
    case 'SET_INITIAL_FILTERS':
      return {
        ...state,
        filters: action.payload,
        initialFilters: action.payload,
      }

    case 'UPDATE_FILTERS':
      return {
        ...state,
        filters: action.payload,
      }

    case 'SET_RESOLVED_SELECTIONS':
      if (!state.filters) return state
      return {
        ...state,
        filters: {
          ...state.filters,
          contestSelection: action.payload,
        },
      }

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
 * The primary hook for managing all problem search functionality.
 * Uses TanStack Query for data fetching, caching, and retries.
 * Maintains a reducer for immediate UI state updates.
 *
 * @returns An object containing the complete search state and handler functions.
 */
export const useProblemSearch = () => {
  // Step 1: Initialize UI state using our reducer
  const [uiState, dispatch] = useReducer(orchestratorReducer, initialState)

  // Check if we're viewing a single problem by ID
  const router = useRouter()
  const searchParams = useSearchParams()
  const problemId = hasProblemId(searchParams) ? searchParams.get('id') : null

  // Step 2: Fetch initial filter options
  const initialDataQuery = useInitialFilterData()

  // Track the query filters separately from UI filters
  // This prevents React Query from creating cache entries for every keystroke
  const [queryFilters, setQueryFilters] = useState<SearchFiltersState | null>(null)

  // Step 3a: Fetch single problem if ID is in URL
  const singleProblemQuery = useSingleProblem(problemId, !!problemId)

  // Step 3b: Search for problems based on current filters (disabled if viewing single problem)
  // Use queryFilters (not uiState.filters) to prevent React Query cache pollution from every keystroke
  const searchQuery = useProblemSearchQuery(
    queryFilters,
    !problemId && uiState.shouldSearch && !initialDataQuery.isLoading
  )

  // Store the filters in a ref for debounced/throttled functions
  const filtersRef = useRef<SearchFiltersState | null>(null)
  filtersRef.current = uiState.filters

  // Track whether we've triggered the initial search
  const hasTriggeredInitialSearch = useRef(false)

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

  // Step 4: Instantiate the URL synchronization hook
  useProblemUrlSync({
    filters: uiState.filters,
    baseOptions: initialDataQuery.data?.updatedOptions ?? null,
    handleFiltersChange,
  })

  // The options with adjusted counts after filtering (e.g. by text)
  const filterOptions =
    singleProblemQuery.data?.options ??
    searchQuery.filterOptions ??
    initialDataQuery.data?.updatedOptions ??
    null

  // The options we stared with
  const baseOptions = initialDataQuery.data?.updatedOptions ?? null

  // Determine overall loading state
  // For single problem queries, treat error states (except when retrying) as not loading
  const isLoading = problemId
    ? singleProblemQuery.isLoading && !singleProblemQuery.error
    : initialDataQuery.isLoading
  const hasInitialDataLoaded = initialDataQuery.isSuccess

  // Determine problem data source (single problem vs search results)
  const problems = singleProblemQuery.data
    ? [singleProblemQuery.data.problem]
    : searchQuery.problems
  const totalCount = singleProblemQuery.data ? 1 : searchQuery.totalCount
  const hasMore = singleProblemQuery.data ? false : searchQuery.hasMore

  // Combine state from multiple sources into a single API
  const state = {
    // Loading states
    isLoading,
    isSearching: !problemId && searchQuery.isSearching,
    isLoadingMore: !problemId && searchQuery.isLoadingMore,
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

    // Compatibility fields
    retryCount: 0,
    isOfflineMode: false,
  }

  return {
    state,
    handleFiltersChange,
    loadMore: searchQuery.loadMore,
  }
}
