import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import type { SearchFiltersState } from '../types/problem-library-types'
import { type CompetitionTree, resolveCompetitionPaths } from './competition-tree'
import { countActiveFilters } from './filter-validation'
import { deserializeFilters, URL_PARAMS } from './search-url-serialization'

/**
 * Creates a default empty search filters state.
 *
 * @returns The filters with nothing filtered on.
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
  competitionSelection: [],
  favoritesOnly: false,
  markStatus: null,
  listContentId: null,
})

/**
 * Result of URL-first filter initialization.
 */
type UrlInitializationResult = {
  /** The filters the library starts out under. */
  filters: SearchFiltersState
  /** Whether the URL named something the library could not read, so none of it was applied. */
  hasInvalidParams: boolean
  /** Whether the URL carried more filters than the library will apply at once. */
  hasTooManyFilters: boolean
  /** Whether the URL asked for the reader's own likes. */
  favoritesRequested: boolean
}

/**
 * Reads a URL into the filters the library starts under. A URL that is empty, that the library
 * cannot read in full, or that carries more filters than it will apply at once all fall back
 * to the defaults.
 *
 * @param searchParams - The URL search parameters
 * @param competitionTree - The taxonomy the competition paths are resolved against
 *
 * @returns The starting filters, alongside what the URL asked for and what it got wrong
 */
export function initializeFiltersFromUrlOrDefaults(
  searchParams: URLSearchParams,
  competitionTree: CompetitionTree
): UrlInitializationResult {
  // Nothing in the URL to read
  if (searchParams.toString().length === 0) {
    // Nothing filtered on, and nothing to answer for
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: false,
      hasTooManyFilters: false,
      favoritesRequested: false,
    }
  }

  // Whether the URL asks for the reader's own likes
  const favoritesRequested = searchParams.get(URL_PARAMS.FAVORITES_ONLY) === 'true'

  // The URL as filters, null when any part of it could not be read
  const parsedFilters = parseAndInterpretFilters(searchParams, competitionTree)

  // A URL the library could not read in full
  if (parsedFilters === null) {
    // All of it is dropped rather than half of it applied
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: true,
      hasTooManyFilters: false,
      favoritesRequested,
    }
  }

  // More filters than the library is willing to apply at once
  if (countActiveFilters(parsedFilters) > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
    // Dropped wholesale rather than truncated
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: false,
      hasTooManyFilters: true,
      favoritesRequested,
    }
  }

  // A URL read in full and within the limit
  return {
    filters: parsedFilters,
    hasInvalidParams: false,
    hasTooManyFilters: false,
    favoritesRequested,
  }
}

/**
 * Reads a URL into the filters it names, with every competition path resolved against the taxonomy.
 * A key the library does not recognize, a season no edition answers to, and a path no node answers
 * to each cost the whole URL.
 *
 * @param searchParams - The URL search parameters.
 * @param competitionTree - The taxonomy the competition paths are resolved against.
 *
 * @returns The {@link SearchFiltersState} the URL names, or null when any part of it could not be read.
 */
function parseAndInterpretFilters(
  searchParams: URLSearchParams,
  competitionTree: CompetitionTree
): SearchFiltersState | null {
  // The filters as the URL names them, competition paths still unresolved
  const rawUrlState = deserializeFilters(searchParams.toString())

  // A key the library does not recognize costs the whole URL
  if (rawUrlState === null) return null

  // A school year is named by its edition number, so anything else names no season at all
  if (rawUrlState.seasons.some((season) => !/^[0-9]+$/.test(season.slug))) return null

  // The paths resolved against the taxonomy as it stands now
  const selections = resolveCompetitionPaths(rawUrlState.competitionPaths, competitionTree)

  // A path no node answers to costs it just the same
  if (selections === null) return null

  // The state the URL named, with the paths it was written with left behind
  const { competitionPaths: _, ...finalState } = rawUrlState

  // The filters, now naming the nodes the paths resolved to
  return {
    ...finalState,
    competitionSelection: selections,
  }
}
