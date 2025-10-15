import { isEqual } from 'lodash'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { countActiveFilters } from './filter-validation'
import { deserializeFilters } from './search-url-serialization'
import { interpretSelectionParts } from './selection-interpreter'

/**
 * Creates a default empty search filters state.
 */
export const createDefaultFilters = (): SearchFiltersState => ({
  searchText: '',
  searchInSolution: false,
  seasons: [],
  problemNumbers: [],
  tags: [],
  tagLogic: 'or',
  authors: [],
  authorLogic: 'or',
  contestSelection: [],
})

/**
 * Configuration for URL-based filter initialization.
 */
interface UrlInitConfig {
  searchParams: URLSearchParams
  currentFilters: SearchFiltersState | null
  competitionsTree: FilterOptionsWithCounts['competitions']
  onFiltersChange: (filters: SearchFiltersState) => void
}

/**
 * Result of the URL filter initialization.
 */
interface UrlInitResult {
  hasInvalidParams: boolean
  hasTooManyFilters?: boolean
}

/**
 * Parses, interprets, and applies search filters from the URL.
 * This is the main entry point for URL handling.
 *
 * @param config - The configuration object.
 * @returns An object indicating whether there were invalid parameters.
 */
export function initializeFiltersFromUrl(config: UrlInitConfig): UrlInitResult {
  const { searchParams, currentFilters, competitionsTree, onFiltersChange } = config

  // Parse URL query string and interpret slugs against competition tree.
  // Returns null if URL contains invalid parameters or unrecognized competition slugs.
  const filtersFromUrl = parseAndInterpretFilters(searchParams, competitionsTree)

  // Signal validation failure so caller can show user feedback (toast).
  if (filtersFromUrl === null) {
    return { hasInvalidParams: true }
  }

  // Validate that URL doesn't contain excessive filters (prevents URL crafting abuse)
  if (countActiveFilters(filtersFromUrl) > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
    // Reject URLs with too many filters - don't apply any filters in this case
    return { hasInvalidParams: false, hasTooManyFilters: true }
  }

  // Avoid unnecessary state updates if parsed filters match current state.
  if (!currentFilters || !isEqual(filtersFromUrl, currentFilters)) {
    onFiltersChange(filtersFromUrl)
  }

  // Good parameters by default
  return { hasInvalidParams: false }
}

/**
 * Orchestrates the two-stage parsing and interpretation of the URL query.
 *
 * @param searchParams - The URL search parameters.
 * @param competitionsTree - The competition tree for context.
 * @returns A fully formed SearchFiltersState, or null if parsing/interpretation fails.
 */
function parseAndInterpretFilters(
  searchParams: URLSearchParams,
  competitionsTree: FilterOptionsWithCounts['competitions']
): SearchFiltersState | null {
  // 1. Pure parsing from URL string to raw parts
  const rawUrlState = deserializeFilters(searchParams.toString())

  // If parsing fails (due to invalid URL format), return null
  if (rawUrlState === null) {
    return null
  }

  // At this point, caller guarantees we have filter parameters (not problemId)
  // because use-problem-url-sync checks hasProblemId() and returns early
  if ('problemId' in rawUrlState) {
    throw new Error(
      'Unexpected problemId in filter initialization - caller should check hasProblemId first'
    )
  }

  // 2. Context-aware interpretation of raw parts
  const selections = interpretSelectionParts(
    rawUrlState.competitionSelectionParts,
    competitionsTree
  )

  // If interpretation fails (due to invalid slugs), return null
  if (selections === null) {
    return null
  }

  // 3. Assemble the final, validated state, omitting the temporary parsing parts
  // At this point we know rawUrlState is the filter-based type, not problemId type
  const { competitionSelectionParts: _, ...finalState } = rawUrlState
  return {
    ...finalState,
    contestSelection: selections,
  }
}
