import type { LabeledSlug } from '../types/problem-api-types'
import type {
  MarkStatusFilter,
  SearchFiltersState,
  UrlQueryState,
} from '../types/problem-library-types'

/**
 * The keys the search filters are written under in the URL.
 */
const FILTER_PARAMS = {
  SEARCH_TEXT: 'q',
  SEARCH_IN_SOLUTION: 'searchInSolution',
  SEASONS: 'seasons',
  PROBLEM_NUMBERS: 'problemNumbers',
  TAGS: 'tags',
  TAG_LOGIC: 'tagLogic',
  AUTHORS: 'authors',
  AUTHOR_LOGIC: 'authorLogic',
  COMPETITIONS: 'competitions',
  FAVORITES_ONLY: 'favoritesOnly',
  MARK_STATUS: 'markStatus',
  LIST: 'list',
} as const

/**
 * The keys the library's chrome is written under in the URL, apart from the filters.
 */
const UI_STATE_PARAMS = {
  /** The key the open competition browser is recorded under. */
  BROWSE_COMPETITIONS: 'browseCompetitions',
} as const

/**
 * Every key the library recognizes in the URL.
 */
export const URL_PARAMS = {
  ...FILTER_PARAMS,
  ...UI_STATE_PARAMS,
} as const

/**
 * The separators the URL's list and path values are read and written with.
 */
const SEPARATORS = {
  LIST: ',',
  HIERARCHY: '-',
} as const

/**
 * Serializes competition selections into a compact string format.
 * A selection is written as its path, and several are joined by commas.
 *
 * @param selections - The competition filters to write.
 *
 * @returns The paths, comma-separated.
 */
const serializeSelections = (selections: SearchFiltersState['competitionSelection']): string => {
  // A path apiece, in the order they were picked
  return selections.map((selection) => selection.path).join(SEPARATORS.LIST)
}

/**
 * Serializes search filters into a URL-safe query string.
 * Only the values that differ from the defaults are written.
 *
 * @param filters - The search filters state to serialize
 *
 * @returns URL query string, empty when nothing is filtered on or the term cannot be encoded
 */
export const serializeFilters = (filters: SearchFiltersState): string => {
  // Encoding a term can throw on a character the URL cannot carry
  try {
    // One key=value pair per filter that is set
    const params: string[] = []

    // The term, when the user typed one, without the padding that is not part of it
    const searchText = filters.searchText.trim()
    if (searchText) {
      params.push(`${URL_PARAMS.SEARCH_TEXT}=${encodeURIComponent(searchText)}`)
    }

    // Reaching into solutions, only when it is on
    if (filters.searchInSolution) {
      params.push(`${URL_PARAMS.SEARCH_IN_SOLUTION}=true`)
    }

    // The school years, by slug
    if (filters.seasons.length > 0) {
      const seasonsValue = filters.seasons.map((season) => season.slug).join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.SEASONS}=${seasonsValue}`)
    }

    // The positions within a round
    if (filters.problemNumbers.length > 0) {
      const numbersValue = filters.problemNumbers.join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.PROBLEM_NUMBERS}=${numbersValue}`)
    }

    // The tags, by slug
    if (filters.tags.length > 0) {
      const tagsValue = filters.tags.map((tag) => tag.slug).join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.TAGS}=${tagsValue}`)

      // The mode only says something once a second tag is in play
      if (filters.tags.length > 1 && filters.tagLogic !== 'or') {
        params.push(`${URL_PARAMS.TAG_LOGIC}=${filters.tagLogic}`)
      }
    }

    // The authors, by slug
    if (filters.authors.length > 0) {
      const authorsValue = filters.authors.map((author) => author.slug).join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.AUTHORS}=${authorsValue}`)

      // The same for authors
      if (filters.authors.length > 1 && filters.authorLogic !== 'or') {
        params.push(`${URL_PARAMS.AUTHOR_LOGIC}=${filters.authorLogic}`)
      }
    }

    // The competitions, each as the path of the node it names
    if (filters.competitionSelection.length > 0) {
      const selectionsValue = serializeSelections(filters.competitionSelection)
      params.push(`${URL_PARAMS.COMPETITIONS}=${selectionsValue}`)
    }

    // Narrowing to the user's own likes, only when it is on
    if (filters.favoritesOnly) {
      params.push(`${URL_PARAMS.FAVORITES_ONLY}=true`)
    }

    // Marked or unmarked, when the user cares
    if (filters.markStatus) {
      params.push(`${URL_PARAMS.MARK_STATUS}=${filters.markStatus}`)
    }

    // The list being browsed, when it is not the whole library
    if (filters.listContentId) {
      params.push(`${URL_PARAMS.LIST}=${encodeURIComponent(filters.listContentId)}`)
    }

    // The pairs, joined as a query string
    return params.join('&')
  } catch (error) {
    // A term that cannot be encoded costs the whole query string
    console.error('Failed to serialize filters:', error)
    return ''
  }
}

/**
 * Reads the URL's query string into the filters, with the competition paths left as written.
 * Validates that all URL parameters are recognized.
 *
 * @param queryString - URL query string to parse
 * @returns Parsed URL query state with the competition paths left unresolved, or null if a param is unrecognized
 */
export const deserializeFilters = (queryString: string): UrlQueryState | null => {
  // The URL read as the keys it names
  const params = new URLSearchParams(queryString)

  // The keys the library knows
  const validKeys = Object.values(URL_PARAMS) as string[]

  // Anything the library does not know
  const hasInvalidParams = Array.from(params.keys()).some((key) => !validKeys.includes(key))

  // One unrecognized key condemns the whole URL
  if (hasInvalidParams) {
    // Nothing is read, so the caller can fall back wholesale
    return null
  }

  // The filters as the URL names them, competition paths still unresolved
  return {
    searchText: params.get(URL_PARAMS.SEARCH_TEXT) || '',
    searchInSolution: params.get(URL_PARAMS.SEARCH_IN_SOLUTION) === 'true',
    seasons: parseSlugArray(params.get(URL_PARAMS.SEASONS)),
    problemNumbers: parseNumberArray(params.get(URL_PARAMS.PROBLEM_NUMBERS)),
    tags: parseSlugArray(params.get(URL_PARAMS.TAGS)),
    tagLogic: parseFilterLogic(params.get(URL_PARAMS.TAG_LOGIC)),
    authors: parseSlugArray(params.get(URL_PARAMS.AUTHORS)),
    authorLogic: parseFilterLogic(params.get(URL_PARAMS.AUTHOR_LOGIC)),
    competitionPaths: parseCompetitionPaths(params.get(URL_PARAMS.COMPETITIONS)),
    favoritesOnly: params.get(URL_PARAMS.FAVORITES_ONLY) === 'true',
    markStatus: parseMarkStatus(params.get(URL_PARAMS.MARK_STATUS)),
    listContentId: params.get(URL_PARAMS.LIST) || null,
  }
}

/**
 * Reads a comma-separated list of slugs, each standing in as its own label until the real names arrive.
 *
 * @param value - The parameter's value, absent when the key is not in the URL.
 * @returns The slugs, each labeled with itself.
 */
const parseSlugArray = (value: string | null): LabeledSlug[] => {
  // Nothing in the URL means nothing filtered on
  if (!value) return []

  // The slugs, with empty segments dropped
  return value
    .split(SEPARATORS.LIST)
    .filter(Boolean)
    .map((slug) => ({ slug, displayName: slug }))
}

/**
 * Parses a string value into the positions within a round it names.
 *
 * @param value - The parameter's value, absent when the key is not in the URL.
 * @returns The positions the value names.
 */
const parseNumberArray = (value: string | null): number[] => {
  // Nothing in the URL means nothing filtered on
  if (!value) return []

  // A position is a whole number counting from one, and anything else names none
  return value
    .split(SEPARATORS.LIST)
    .filter(Boolean)
    .map(Number)
    .filter((problemNumber) => Number.isInteger(problemNumber) && problemNumber > 0)
}

/**
 * Parses a tag or author logic URL parameter value into the mode it names.
 * Only a mode the filter actually offers is taken; anything else reads as matching any.
 *
 * @param value - The parameter's value, absent when the key is not in the URL.
 * @returns The mode the value names, or matching any when it names none.
 */
const parseFilterLogic = (value: string | null): SearchFiltersState['tagLogic'] => {
  // Matching all of them has to be asked for by name
  if (value?.toLowerCase() === 'and') return 'and'

  // Anything else, a mode the filter does not offer included, reads as matching any
  return 'or'
}

/**
 * Parses competition paths from a URL parameter value, without resolving any of them against the taxonomy.
 * A path is taken whole, so nothing here has to know how deep the taxonomy runs; empty segments are
 * dropped so a hand-edited `csmo--a` still names `csmo-a`.
 *
 * @param value - URL parameter value containing the comma-separated competition paths
 * @returns The paths, with anything that emptied out left off
 */
const parseCompetitionPaths = (value: string | null): string[] => {
  // Nothing in the URL means nothing filtered on
  if (!value) return []

  // Each path with its empty segments squeezed out, and anything left empty dropped
  return value
    .split(SEPARATORS.LIST)
    .map((path) => path.split(SEPARATORS.HIERARCHY).filter(Boolean).join(SEPARATORS.HIERARCHY))
    .filter(Boolean)
}

/**
 * Parses a mark status URL parameter value into a typed filter value.
 * Only a value the filter actually offers is taken; anything else reads as no filter at all.
 *
 * @param value - URL parameter value to parse
 *
 * @returns The mark filter, or null when the URL names none.
 */
const parseMarkStatus = (value: string | null): MarkStatusFilter | null => {
  // A value the filter offers stands as it is
  if (value === 'marked' || value === 'unmarked') return value

  // Anything else reads as not caring
  return null
}
