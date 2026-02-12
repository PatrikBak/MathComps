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
  favoritesOnly: false,
  markStatus: null,
  listContentId: null,
})

/**
 * Result of URL-first filter initialization.
 */
type UrlInitializationResult = {
  /** The parsed filters (from URL or defaults) */
  filters: SearchFiltersState
  /** Whether the URL contained invalid parameters that were ignored */
  hasInvalidParams: boolean
  /** Whether the URL contained too many filters */
  hasTooManyFilters: boolean
  /** Whether favorites mode was requested */
  favoritesRequested: boolean
  /** Whether a list filter was requested (needed for auth checks) */
  listRequested: boolean
}

/**
 * Parses filters from URL. Falls back to defaults if URL is empty or invalid.
 *
 * @param searchParams - The URL search parameters
 * @param competitionsTree - The competition tree for resolving contest selections
 *
 * @returns Parsed filters and validation flags
 */
export function initializeFiltersFromUrlOrDefaults(
  searchParams: URLSearchParams,
  competitionsTree: FilterOptionsWithCounts['competitions']
): UrlInitializationResult {
  // No URL params = default filters
  if (searchParams.toString().length === 0) {
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: false,
      hasTooManyFilters: false,
      favoritesRequested: false,
      listRequested: false,
    }
  }

  // Check if favorites was requested (needed for auth checks)
  const favoritesRequested = searchParams.get('favoritesOnly') === 'true'

  // Check if a list filter was requested (needed for auth checks)
  const listRequested = searchParams.get('list') !== null

  // Parse and validate URL parameters
  const parsed = parseAndInterpretFilters(searchParams, competitionsTree)

  // Invalid URL = default filters
  if (parsed === null) {
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: true,
      hasTooManyFilters: false,
      favoritesRequested,
      listRequested,
    }
  }

  // Check filter count limit
  if (countActiveFilters(parsed) > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: false,
      hasTooManyFilters: true,
      favoritesRequested,
      listRequested,
    }
  }

  // Happy path - valid URL with valid filters
  return {
    filters: parsed,
    hasInvalidParams: false,
    hasTooManyFilters: false,
    favoritesRequested,
    listRequested,
  }
}

/**
 * Pure function to parse URL params into filters or null if parsing fails.
 *
 * @param searchParams - The URL search parameters.
 * @param competitionsTree - The competition tree to resolve labels from slugs.
 *
 * @returns Parsed {@link SearchFiltersState}, or null if parsing/interpretation fails.
 */
function parseAndInterpretFilters(
  searchParams: URLSearchParams,
  competitionsTree: FilterOptionsWithCounts['competitions']
): SearchFiltersState | null {
  // Pure parsing from URL string to raw parts
  const rawUrlState = deserializeFilters(searchParams.toString())

  // If parsing fails (due to invalid URL format), return null
  if (rawUrlState === null) return null

  // Context-aware interpretation of raw parts
  const selections = interpretSelectionParts(
    rawUrlState.competitionSelectionParts,
    competitionsTree
  )

  // If interpretation fails, return null
  if (selections === null) return null

  // Assemble the final, validated state, omitting the temporary parsing parts
  const { competitionSelectionParts: _, ...finalState } = rawUrlState
  return {
    ...finalState,
    contestSelection: selections,
  }
}
