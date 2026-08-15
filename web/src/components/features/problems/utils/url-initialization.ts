import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import type { SearchFiltersState } from '../types/problem-library-types'
import type { CompetitionTree } from './competition-tree'
import { countActiveFilters } from './filter-validation'
import { deserializeFilters } from './search-url-serialization'

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
}

/**
 * Reads a URL into the filters the library starts under, without a taxonomy to hand. A URL that is
 * empty, that the library cannot read in full, or that carries more filters than it will apply at
 * once all fall back to the defaults.
 *
 * The competition paths it returns are the ones the URL was written with, still unproven: only
 * {@link namesOnlyKnownCompetitions} can say whether the taxonomy still answers to them, and it needs
 * the taxonomy that arrives with the first answer from the archive.
 *
 * @param searchParams - The URL search parameters
 *
 * @returns The starting filters, alongside what the URL asked for and what it got wrong
 */
export function initializeFiltersFromUrlOrDefaults(
  searchParams: URLSearchParams
): UrlInitializationResult {
  // Nothing in the URL to read
  if (searchParams.toString().length === 0) {
    // Nothing filtered on, and nothing to answer for
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: false,
      hasTooManyFilters: false,
    }
  }

  // The URL as filters, null when any part of it could not be read
  const parsedFilters = parseAndInterpretFilters(searchParams)

  // A URL the library could not read in full
  if (parsedFilters === null) {
    // All of it is dropped rather than half of it applied
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: true,
      hasTooManyFilters: false,
    }
  }

  // More filters than the library is willing to apply at once
  if (countActiveFilters(parsedFilters) > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
    // Dropped wholesale rather than truncated
    return {
      filters: createDefaultFilters(),
      hasInvalidParams: false,
      hasTooManyFilters: true,
    }
  }

  // A URL read in full and within the limit
  return {
    filters: parsedFilters,
    hasInvalidParams: false,
    hasTooManyFilters: false,
  }
}

/**
 * Reads a URL into the filters it names. A key the library does not recognize and a season no edition
 * answers to each cost the whole URL.
 *
 * @param searchParams - The URL search parameters.
 *
 * @returns The {@link SearchFiltersState} the URL names, or null when any part of it could not be read.
 */
function parseAndInterpretFilters(searchParams: URLSearchParams): SearchFiltersState | null {
  // The filters as the URL names them
  const rawUrlState = deserializeFilters(searchParams.toString())

  // A key the library does not recognize costs the whole URL
  if (rawUrlState === null) return null

  // A school year is named by its edition number, so anything else names no season at all
  if (rawUrlState.seasons.some((season) => !/^[0-9]+$/.test(season.slug))) return null

  // The state the URL named, with the paths lifted out of it
  const { competitionPaths, ...finalState } = rawUrlState

  // The filters, each competition standing as the path the URL addressed it by
  return {
    ...finalState,
    competitionSelection: competitionPaths.map((path) => ({ path })),
  }
}

/**
 * Whether every competition a URL's filters name still answers to a node in the taxonomy, which only
 * arrives once the archive has answered.
 *
 * A path no node answers to costs the whole URL rather than only itself, since a filter honoured in
 * part is worse than one obviously refused. The archive has by then already been asked for those
 * filters, so what a refusal here throws away is the state, not the request spent on it.
 *
 * @param filters - The filters the URL named.
 * @param competitionTree - The taxonomy to hold them against.
 *
 * @returns Whether the taxonomy still knows all of them.
 */
export function namesOnlyKnownCompetitions(
  filters: SearchFiltersState,
  competitionTree: CompetitionTree
): boolean {
  // Every competition named has to still be there, since the URL was written against an older taxonomy
  return filters.competitionSelection.every((selection) =>
    competitionTree.byPath.has(selection.path)
  )
}
