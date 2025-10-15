import type { SearchFiltersState, UrlQueryState } from '../types/problem-library-types'

/**
 * URL parameter keys used for serialization
 */
const URL_PARAMS = {
  SEARCH_TEXT: 'q',
  SEARCH_IN_SOLUTION: 'searchInSolution',
  SEASONS: 'seasons',
  PROBLEM_NUMBERS: 'problemNumbers',
  TAGS: 'tags',
  TAG_LOGIC: 'tagLogic',
  AUTHORS: 'authors',
  AUTHOR_LOGIC: 'authorLogic',
  COMPETITIONS: 'competitions',
  PROBLEM_ID: 'id',
} as const

/**
 * Separators used in URL encoding
 */
const SEPARATORS = {
  LIST: ',',
  HIERARCHY: '-',
} as const

/**
 * Serializes competition selections into a compact string format.
 * Uses dashes to separate hierarchy levels and commas to separate multiple selections.
 *
 * @param selections - Array of filter selections to serialize
 * @returns Serialized string representation
 */
const serializeSelections = (selections: SearchFiltersState['contestSelection']): string => {
  const serializedSelections = selections.map((selection) => {
    switch (selection.type) {
      case 'competition':
        return selection.competitionSlug
      case 'category':
        return `${selection.competitionSlug}${SEPARATORS.HIERARCHY}${selection.categorySlug}`
      case 'round':
        // Smart serialization: only include category if it exists
        if (selection.categorySlug) {
          return `${selection.competitionSlug}${SEPARATORS.HIERARCHY}${selection.categorySlug}${SEPARATORS.HIERARCHY}${selection.roundSlug}`
        } else {
          return `${selection.competitionSlug}${SEPARATORS.HIERARCHY}${selection.roundSlug}`
        }
    }
  })

  return serializedSelections.join(SEPARATORS.LIST)
}

/**
 * Serializes search filters into a URL-safe query string.
 * Only includes non-default values to maintain clean, shareable URLs.
 *
 * @param filters - The search filters state to serialize
 * @returns URL query string, or empty string if all filters are default
 */
export const serializeFilters = (filters: SearchFiltersState): string => {
  try {
    const params: string[] = []

    if (filters.searchText?.trim()) {
      params.push(`${URL_PARAMS.SEARCH_TEXT}=${encodeURIComponent(filters.searchText)}`)
    }

    if (filters.searchInSolution) {
      params.push(`${URL_PARAMS.SEARCH_IN_SOLUTION}=true`)
    }

    if (filters.seasons?.length > 0) {
      const seasonsValue = filters.seasons.map((season) => season.slug).join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.SEASONS}=${seasonsValue}`)
    }

    if (filters.problemNumbers?.length > 0) {
      const numbersValue = filters.problemNumbers.join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.PROBLEM_NUMBERS}=${numbersValue}`)
    }

    if (filters.tags?.length > 0) {
      const tagsValue = filters.tags.map((tag) => tag.slug).join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.TAGS}=${tagsValue}`)

      // Only include tagLogic if there are multiple tags and logic is not 'or'
      // For single tags, the logic parameter is redundant and can be omitted
      if (filters.tags.length > 1 && filters.tagLogic !== 'or') {
        params.push(`${URL_PARAMS.TAG_LOGIC}=${filters.tagLogic}`)
      }
    }

    if (filters.authors?.length > 0) {
      const authorsValue = filters.authors.map((author) => author.slug).join(SEPARATORS.LIST)
      params.push(`${URL_PARAMS.AUTHORS}=${authorsValue}`)

      // Only include authorLogic if there are multiple authors and logic is not 'or'
      // For single authors, the logic parameter is redundant and can be omitted
      if (filters.authors.length > 1 && filters.authorLogic !== 'or') {
        params.push(`${URL_PARAMS.AUTHOR_LOGIC}=${filters.authorLogic}`)
      }
    }

    if (filters.contestSelection?.length > 0) {
      const selectionsValue = serializeSelections(filters.contestSelection)
      params.push(`${URL_PARAMS.COMPETITIONS}=${selectionsValue}`)
    }

    return params.join('&')
  } catch (error) {
    console.error('Failed to serialize filters:', error)
    return ''
  }
}

/**
 * Deserializes URL query string into search filters state.
 * Validates that all URL parameters are recognized.
 *
 * @param queryString - URL query string to parse
 * @returns Parsed URL query state with raw selection parts, or null if parsing fails or has invalid params
 */
export const deserializeFilters = (queryString: string): UrlQueryState | null => {
  try {
    const params = new URLSearchParams(queryString)

    // Validate all parameters are recognized
    const validKeys = Object.values(URL_PARAMS) as string[]
    const hasInvalidParams = Array.from(params.keys()).some((key) => !validKeys.includes(key))

    // Check if this is a problem ID URL
    const problemId = params.get(URL_PARAMS.PROBLEM_ID)
    if (problemId) {
      if (hasInvalidParams) {
        console.warn('Invalid URL parameters detected with problem ID:', queryString)
        return null
      }

      return {
        problemId,
      }
    }

    if (hasInvalidParams) {
      console.warn('Invalid URL parameters detected:', queryString)
      return null
    }

    // Otherwise, it's a filter-based URL
    return {
      searchText: params.get(URL_PARAMS.SEARCH_TEXT) || '',
      searchInSolution: params.get(URL_PARAMS.SEARCH_IN_SOLUTION) === 'true',
      seasons: parseSlugArray(params.get(URL_PARAMS.SEASONS)),
      problemNumbers: parseNumberArray(params.get(URL_PARAMS.PROBLEM_NUMBERS)),
      tags: parseSlugArray(params.get(URL_PARAMS.TAGS)),
      tagLogic: (params.get(URL_PARAMS.TAG_LOGIC)?.toLowerCase() as 'or' | 'and') || 'or',
      authors: parseSlugArray(params.get(URL_PARAMS.AUTHORS)),
      authorLogic: (params.get(URL_PARAMS.AUTHOR_LOGIC)?.toLowerCase() as 'or' | 'and') || 'or',
      competitionSelectionParts: parseCompetitionSelectionParts(
        params.get(URL_PARAMS.COMPETITIONS)
      ),
    }
  } catch (error) {
    console.error('Failed to deserialize filters:', error)
    return null
  }
}

/**
 * Parses a string value into an array of slug objects.
 *
 * @param value - String value to parse
 * @returns Array of slug objects
 */
const parseSlugArray = (value: string | null) => {
  if (!value) return []

  return value
    .split(SEPARATORS.LIST)
    .filter(Boolean)
    .map((slug) => ({ slug, displayName: slug }))
}

/**
 * Parses a string value into an array of numbers.
 *
 * @param value - String value to parse
 * @returns Array of valid numbers
 */
const parseNumberArray = (value: string | null): number[] => {
  if (!value) return []

  return value
    .split(SEPARATORS.LIST)
    .map(Number)
    .filter((n) => !isNaN(n))
}

/**
 * Parses competition selections from URL parameter value.
 *
 * @param value - URL parameter value containing competition selections
 * @returns Array of parsed filter selections, each as an array of its parts
 */
const parseCompetitionSelectionParts = (value: string | null): string[][] => {
  if (!value) return []

  return value.split(SEPARATORS.LIST).map((selectionString) => {
    const parts = parseSelectionParts(selectionString)
    return parts || []
  })
}

/**
 * Parses a selection string into raw parts without any interpretation.
 * Pure structural parsing - just splits on dashes and filters out empty parts.
 *
 * @param selectionString - String like "csmo", "csmo-a", "csmo-a-i"
 * @returns Array of parts, or null if invalid/empty
 */
const parseSelectionParts = (selectionString: string): string[] | null => {
  const parts = selectionString.split(SEPARATORS.HIERARCHY).filter(Boolean)

  if (parts.length === 0) {
    console.warn(`Empty selection format: ${selectionString}`)
    return null
  }

  return parts
}
