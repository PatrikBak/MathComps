'use client'

import { useAuth } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'
import { useProblemStore } from '@/stores/problem-store'
import { isNetworkError, isServerError, isValidationError } from '@/types/api'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import { SEARCH_TIMING } from '../constants/timing-constants'
import { getProblemsPageUrl, hasProblemId } from '../services/problem-api-urls'
import {
  isListAccessDeniedError,
  isListNotFoundError,
  isProblemNotFoundError,
} from '../types/problem-errors'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { countActiveFilters } from '../utils/filter-validation'
import { isNoOpFilterChange, isTextOnlyChange } from '../utils/search-logic'
import { serializeFilters } from '../utils/search-url-serialization'
import { initializeFiltersFromUrlOrDefaults } from '../utils/url-initialization'
import {
  useInitialFilterData,
  useProblemSearchQuery,
  useSingleProblem,
} from './use-problem-search-query'

/**
 * The problem search state: loading flags, active filters, and the current result page.
 */
type ProblemSearchState = {
  /** Whether the initial data or search results are currently loading. */
  isPageLoading: boolean
  /** Whether a search is happening in the background (e.g., while typing or filtering). */
  isActiveSearchFetching: boolean
  /** Whether a search with genuinely new filters is in progress (first fetch, no cached data). */
  isBlankSlateLoading: boolean
  /** Whether more results are being loaded (infinite scroll). */
  isPaginationLoading: boolean
  /** Whether the initial filter options and configuration have been loaded. */
  hasInitialDataLoaded: boolean

  /** The current active filters. */
  filters: SearchFiltersState | null
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
  /** When filtering by a list, the display name of that list. Null otherwise. */
  listName: string | null
}

/**
 * The return type of the {@link useProblemSearch} hook.
 * Encapsulates the entire state and actions available for the problem search feature.
 */
type UseProblemSearchReturn = {
  /** The current state of the problem search, including loading status, filters, and data. */
  state: ProblemSearchState
  /** Handler for updating the search filters. */
  handleFiltersChange: (newFilters: SearchFiltersState) => void
  /** Handler to load more results (infinite scroll). */
  loadMore: () => void
}

/**
 * The primary hook for managing all problem search functionality.
 *
 * @returns An object containing the complete search state and handler functions.
 */
export const useProblemSearch = (): UseProblemSearchReturn => {
  // Translations for problem-related errors
  const tErrors = useTranslations('problems.errors')

  // Navigation hooks for URL manipulation
  const router = useRouter()
  const searchParams = useSearchParams()

  // Transition for non-blocking URL updates
  const [, startTransition] = useTransition()

  // Check if we're viewing a single problem by its slug (URL: /problems?id=problem-slug)
  // When viewing a single problem, we skip the search flow entirely
  const problemId = hasProblemId(searchParams) ? searchParams.get('id') : null

  // Get authentication state from Clerk
  // - userId: the current user's ID, or null/undefined if not signed in
  // - isLoaded: whether the auth state has been determined (important for SSR)
  const { userId, isLoaded: isUserDataLoaded } = useAuth()

  // Hook to redirect to login page (used when user tries to access favorites without auth)
  const { redirectToLogin } = useLoginRedirect()

  // Safely extract userId for React Query cache keys
  // Type assertion: when isLoaded is true, userId is guaranteed to be string | null (never undefined)
  const safeUserId = isUserDataLoaded ? (userId ?? null) : null

  // Current locale for localized API responses
  const locale = useLocale()

  // Fetch initial filter options from the API.
  // This returns the base options (all competitions, tags, authors, seasons, etc.)
  // that populate the filter dropdowns. The counts reflect totals without any filters.
  const initialDataQuery = useInitialFilterData(locale, safeUserId, isUserDataLoaded)

  // Extract the options for convenient access throughout the hook
  const baseOptions = initialDataQuery.data?.updatedOptions ?? null

  // Fetch a single problem when the URL has ?id=problem-slug
  // This bypasses the search flow entirely and shows just that one problem.
  // Only fetch when we have a problem ID and auth is ready (because problem
  // data have isLiked field, which is user-specific)
  const singleProblemQuery = useSingleProblem(
    locale,
    problemId,
    safeUserId,
    !!problemId && isUserDataLoaded
  )

  // Parse filters from URL (the single source of truth)
  // Returns both filters and metadata about parsing issues
  const urlParsingResult = useMemo(() => {
    // Can't parse without base options (need competition tree for validation)
    if (!baseOptions) return null

    // Single problem view doesn't use URL filters
    if (problemId) return null

    // A helper pure function does the job
    return initializeFiltersFromUrlOrDefaults(searchParams, baseOptions.competitions)
  }, [searchParams, baseOptions, problemId])

  // Extract filters for convenience
  const urlFilters = urlParsingResult?.filters ?? null

  // Show toast for invalid URL params
  useEffect(() => {
    // URL needs to be parsed
    if (!urlParsingResult) return

    // Show toast for invalid URL params
    if (urlParsingResult.hasInvalidParams) {
      toast.warning(tErrors('urlFiltersIgnored'))
    }
    // Show toast for too many filters
    else if (urlParsingResult.hasTooManyFilters) {
      toast.warning(tErrors('urlTooManyFilters', { max: ACTIVE_FILTERS_CONSTANTS.maxFilterLimit }))
    }
  }, [urlParsingResult, tErrors])

  // Redirect to login if favorites were requested but user is not logged in
  // Note: lists are NOT guarded here because they can be publicly shared —
  // the backend handles access control (200 for public, 403 for private)
  useEffect(() => {
    // URL needs to be parsed and an auth-required feature was requested
    if (!urlParsingResult?.favoritesRequested) return

    // We must wait for auth data to be loaded
    if (!isUserDataLoaded) return

    // User is not logged in, we should redirect to login
    if (!userId) {
      redirectToLogin()
    }
  }, [urlParsingResult?.favoritesRequested, isUserDataLoaded, userId, redirectToLogin])

  // Track the query filters separately from UI filters.
  // This prevents React Query from creating cache entries for every keystroke.
  // The separation is crucial for a responsive user experience:
  // - UI filters update instantly when user changes a filter
  // - Query filters update after debounce (for text) or immediately (for discrete)
  // - React Query only fetches based on queryFilters, not every UI change
  const [queryFilters, setQueryFilters] = useState<SearchFiltersState | null>(null)

  // The ref is needed to check if there has been only text changes to the filters
  const prevUrlFiltersRef = useRef<SearchFiltersState | null>(null)

  // Sync queryFilters from urlFilters whenever URL changes.
  // Uses isTextOnlyChange to determine debounce behavior:
  //   - Text-only changes: debounce to avoid API spam while typing
  //   - Discrete changes: sync immediately for responsive feedback
  useEffect(() => {
    // Handle when we have not loaded the filters yet
    if (!urlFilters) {
      setQueryFilters(null)
      prevUrlFiltersRef.current = null
      return
    }

    // If this is the first load (no previous filters), sync immediately
    if (!prevUrlFiltersRef.current) {
      setQueryFilters(urlFilters)
      prevUrlFiltersRef.current = urlFilters
      return
    }

    // Skip no-op changes (e.g. toggling OR↔AND with ≤1 item selected)
    // These can't produce different results, so don't trigger a new fetch
    if (isNoOpFilterChange(prevUrlFiltersRef.current, urlFilters)) {
      prevUrlFiltersRef.current = urlFilters
      return
    }

    // If we had previous filters, check if this is a text-only change
    if (isTextOnlyChange(prevUrlFiltersRef.current, urlFilters)) {
      // Text-only change: debounce to avoid API spam
      const timer = setTimeout(() => {
        setQueryFilters(urlFilters)
        prevUrlFiltersRef.current = urlFilters
      }, SEARCH_TIMING.textDebounceMs)
      return () => clearTimeout(timer)
    } else {
      // Discrete change: sync immediately
      setQueryFilters(urlFilters)
      prevUrlFiltersRef.current = urlFilters
    }
  }, [urlFilters])

  // Search for problems based on queryFilters.
  // Note: we use queryFilters (not displayFilters) to prevent React Query cache
  // pollution from every keystroke. The query will only run when:
  //   1. We're not viewing a single problem by ID
  //   2. queryFilters is set (not null)
  //   3. Initial data has finished loading
  //   4. User auth state is loaded (to ensure correct favorites/likes context)
  const searchQuery = useProblemSearchQuery(
    locale,
    queryFilters,
    safeUserId,
    !problemId && queryFilters !== null && !initialDataQuery.isLoading && isUserDataLoaded
  )

  // Local filters for instant UI feedback (mirrors URL but updates immediately)
  // Why do we need local state?
  // - router.replace() is async - URL doesn't update until next render
  // - We want UI to feel INSTANT when user clicks or types
  // - So we: update local state immediately, then update URL in background
  // - displayFilters uses localFilters for instant feedback
  const [localFilters, setLocalFilters] = useState<SearchFiltersState | null>(null)

  // Sync local filters with URL (on page load or when URL changes externally)
  // This handles: initial load, browser back/forward, external link navigation
  useEffect(() => {
    setLocalFilters(urlFilters)
  }, [urlFilters])

  // The main function exposed to the UI for handling filter changes.
  // This is the ONLY way filter state should be modified - it ensures:
  //   1. URL is always updated (the source of truth)
  //   2. Local filters update immediately for responsive feedback
  //   3. Query filters update via the sync effect (debounced for text, immediate for discrete)
  const handleFiltersChange = useCallback(
    (newFilters: SearchFiltersState) => {
      // Validate filter count - prevent users from adding too many filters
      // which would create excessively long URLs
      const filterCount = countActiveFilters(newFilters)
      if (filterCount > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
        toast.warning(
          tErrors('maxFiltersExceeded', { max: ACTIVE_FILTERS_CONSTANTS.maxFilterLimit })
        )
        return
      }

      // Update local filters immediately for instant UI feedback
      // This makes the UI feel snappy while URL/queryFilters update
      setLocalFilters(newFilters)

      // Update URL in a low-priority transition
      // This prevents blocking the main thread
      startTransition(() => {
        const queryString = serializeFilters(newFilters)
        const url = getProblemsPageUrl(queryString)
        router.replace(url, { scroll: false })
      })
    },
    [router, tErrors]
  )

  // Compute the filters to display in the UI.
  // We use local filters for instant feedback.
  const displayFilters = useMemo((): SearchFiltersState | null => {
    // Single problem view: use problem's own filters
    if (problemId) return singleProblemQuery.data?.filters ?? null

    // Search view: use local filters
    return localFilters
  }, [problemId, singleProblemQuery.data?.filters, localFilters])

  // Sync filters to global store
  useEffect(() => {
    useProblemStore.getState().setCurrentFilters(displayFilters)
  }, [displayFilters])

  // Handle errors when fetching a single problem by ID.
  // Different error types get different UX:
  // - Not found: redirect to problem list + toast
  // - Network/server error: toast only (React Query will retry)
  // - Validation error: redirect to problem list + toast
  useEffect(() => {
    // Only show if we're viewing a single problem by ID and we have an error
    if (!singleProblemQuery.error || !problemId) return

    // Get error details
    const error = singleProblemQuery.error
    const isFirstError = singleProblemQuery.failureCount === 1

    // Truncate ID for display (to prevent long strings in toast messages)
    const maxIdLength = 20
    const truncatedId =
      problemId.length > maxIdLength ? `${problemId.slice(0, maxIdLength)}...` : problemId

    // Handle different error types
    if (isProblemNotFoundError(error)) {
      // Problem not found: redirect to problem list + toast
      toast.error(tErrors('problemNotFound', { problemId: truncatedId }))
      router.replace(ROUTES.PROBLEMS, { scroll: false })
    } else if (isNetworkError(error) && isFirstError) {
      // Network error: toast only (React Query will retry)
      toast.error(tErrors('connectionProblem'))
    } else if (isServerError(error) && isFirstError) {
      // Server error: toast only (React Query will retry)
      toast.error(tErrors('serverError'))
    } else if (isValidationError(error)) {
      // Validation error: redirect to problem list + toast
      toast.error(tErrors('invalidParameters'))
      router.replace(ROUTES.PROBLEMS, { scroll: false })
    } else if (isFirstError) {
      // Unexpected error: toast only
      toast.error(tErrors('unexpectedError'))
    }
  }, [
    problemId,
    singleProblemQuery.error,
    singleProblemQuery.isFetching,
    singleProblemQuery.failureCount,
    router,
    tErrors,
  ])

  // Show a toast when search is retrying
  useEffect(() => {
    // Show when not viewing a single problem and search is retrying
    // (either initial data or problem search results)
    const shouldShowToast = !problemId && initialDataQuery.isSuccess && searchQuery.isRetrying
    if (shouldShowToast) {
      // Show loading toast while retrying
      const toastId = toast.loading(tErrors('connectionProblem'), { duration: Infinity })

      // Clear toast when search stops retrying
      return () => {
        toast.dismiss(toastId)
      }
    }

    // No cleanup needed
    return undefined
  }, [problemId, initialDataQuery.isSuccess, searchQuery.isRetrying, tErrors])

  // Handle list access errors
  // Show a toast with a clear message and redirect to /problems to clear the invalid list= URL param
  useEffect(() => {
    // Only handle when the search query has a typed error
    const error = searchQuery.rawError
    if (!error) return

    // Show a descriptive toast based on the error type
    if (isListNotFoundError(error)) {
      toast.error(tErrors('listNotFound'))
    } else if (isListAccessDeniedError(error)) {
      toast.error(tErrors('listAccessDenied'))
    } else {
      // Not a list access error, nothing to handle here
      return
    }

    // Redirect to /problems to clear the invalid list= URL param
    router.replace(ROUTES.PROBLEMS, { scroll: false })
  }, [searchQuery.rawError, router, tErrors])

  // Get the final filter options.
  // This is where we decide which options to show in the UI dropdowns.
  // Priority order:
  //   1. Single problem view: use problem's own options
  //   2. Search results: use filtered options with updated counts
  //   3. Initial data: use base options (before any search)
  const filterOptions = singleProblemQuery.data?.options ?? searchQuery.filterOptions ?? baseOptions

  // Are we loading anything?
  const isPageLoading = problemId
    ? singleProblemQuery.isLoading && !singleProblemQuery.error
    : initialDataQuery.isLoading

  // Do we have the data with search filter options ready?
  const hasInitialDataLoaded = initialDataQuery.isSuccess

  // Are we loading new data, i.e. a new query key?
  const isBlankSlateLoading = !problemId && searchQuery.isPending

  // Is any search query currently running?
  const isActiveSearchFetching = !problemId && searchQuery.isFetching

  // Are we loading more pages?
  const isPaginationLoading = !problemId && searchQuery.isFetchingNextPage

  // Problems from global store
  const displayedProblems = useProblemStore((state) => state.displayedProblems)
  const problems = problemId ? [problemId] : displayedProblems
  const totalCount = problemId ? 1 : searchQuery.totalCount
  const hasMore = problemId ? false : searchQuery.hasMore

  // The error message
  const error = initialDataQuery.isRetrying ? tErrors('serverError') : null

  // State + actions to return
  return {
    state: {
      isPageLoading,
      isActiveSearchFetching,
      isBlankSlateLoading,
      isPaginationLoading,
      hasInitialDataLoaded,
      filters: displayFilters,
      filterOptions,
      baseOptions,
      problems,
      totalCount,
      hasMore,
      currentPage: 1,
      error,
      listName: searchQuery.listName,
    },
    handleFiltersChange,
    loadMore: searchQuery.loadMore,
  }
}
