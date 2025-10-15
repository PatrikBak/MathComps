import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { initializeFiltersFromUrl } from '../utils/url-initialization'
import { hasProblemId } from '../utils/url-problem-resolver'

/**
 * Parameters required for URL synchronization of problem search filters.
 * This type captures all dependencies needed to parse URL parameters and apply them
 * to the search state, enabling bookmarkable and shareable problem library views.
 */
type UrlSyncParams = {
  /** Current active filter state - used to detect changes and avoid redundant updates */
  filters: SearchFiltersState | null
  /** Available filter options with counts - needed to validate URL parameters against actual data */
  baseOptions: FilterOptionsWithCounts | null
  /** Callback to apply parsed URL filters to component state - bridges URL and React state */
  handleFiltersChange: (filters: SearchFiltersState) => void
}

/**
 * Handles the one-time side effect of synchronizing the problem search state
 * with the URL's search parameters when the component mounts. This allows for
 * bookmarking and sharing specific search views.
 *
 * @param params - An object containing the current filters, base filter options,
 * and the handler for filter changes.
 */
export const useProblemUrlSync = ({ filters, baseOptions, handleFiltersChange }: UrlSyncParams) => {
  // Access URL search parameters to enable bookmarkable filter states
  const searchParams = useSearchParams()

  // Prevent multiple URL syncs during component lifecycle - this is a one-time operation
  const isInitializedFromUrl = useRef(false)

  // Synchronize URL parameters with component state on mount, enabling shareable search URLs
  useEffect(() => {
    // Wait for server data to be available before attempting URL synchronization
    // This prevents race conditions where URL parsing happens before filter options are loaded
    if (!baseOptions || isInitializedFromUrl.current) {
      return
    }

    // No URL parameters means no synchronization needed - use default state
    if (searchParams.toString().length == 0) {
      isInitializedFromUrl.current = true
      return
    }

    // Skip filter synchronization when viewing individual problems to avoid conflicts
    // Individual problem pages handle their own URL state management
    if (hasProblemId(searchParams)) {
      return
    }

    // Mark as processed to prevent duplicate URL parsing on re-renders
    // This flag is set after the problem ID check to allow filter initialization
    // when navigating from a problem detail page to a filtered search
    isInitializedFromUrl.current = true

    // Parse and validate URL parameters, then update component state to match URL
    // This enables users to bookmark and share specific search configurations
    const { hasInvalidParams, hasTooManyFilters } = initializeFiltersFromUrl({
      searchParams,
      currentFilters: filters,
      competitionsTree: baseOptions.competitions,
      onFiltersChange: handleFiltersChange,
    })

    // Notify users about malformed URL parameters that couldn't be applied
    // This provides feedback when shared URLs contain invalid or outdated parameters
    if (hasInvalidParams) {
      toast.warning('Niektoré parametre v URL boli ignorované')
    } else if (hasTooManyFilters) {
      toast.warning(
        `URL obsahuje príliš veľa filtrov (maximálne ${ACTIVE_FILTERS_CONSTANTS.maxFilterLimit})`
      )
    }
  }, [baseOptions, searchParams, filters, handleFiltersChange])
}
