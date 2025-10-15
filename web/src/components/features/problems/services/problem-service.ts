import type { FilterParameters } from '../types/problem-api-types'
import type { ProblemError, ProblemNotFoundError } from '../types/problem-errors'
import type {
  ContestSelection,
  FilterResponse,
  SearchFiltersState,
  SingleProblemResult,
} from '../types/problem-library-types'
import { getProblemBySlugApiUrl, getProblemsFilterApiUrl } from '../utils/url-utils'

/**
 * Error message constants for consistent error reporting.
 */
const ERROR_MESSAGES = {
  PROBLEM_NOT_FOUND: (slug: string) => `Problem "${slug}" not found`,
  SERVER_NON_JSON: 'API returned non-JSON response - server may be down',
  NETWORK_ERROR: (status: number, statusText: string) =>
    `API request failed with status ${status}: ${statusText}`,
  UNEXPECTED_ERROR: 'An unexpected error occurred',
} as const

/**
 * Fetches a single problem by its slug from the API.
 * Returns the problem with its associated filters and options for the ProblemsLibrary component.
 */
export async function getProblemBySlug(
  slug: string
): Promise<
  { isSuccess: true; value: SingleProblemResult } | { isSuccess: false; error: ProblemError }
> {
  try {
    const apiUrl = getProblemBySlugApiUrl(slug)

    // Use the specific problem slug endpoint
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return {
          isSuccess: false,
          error: {
            type: 'PROBLEM_NOT_FOUND',
            slug,
            message: ERROR_MESSAGES.PROBLEM_NOT_FOUND(slug),
          } as ProblemNotFoundError,
        }
      }

      return {
        isSuccess: false,
        error: {
          type: 'NETWORK_ERROR',
          message: ERROR_MESSAGES.NETWORK_ERROR(response.status, response.statusText),
          status: response.status,
        },
      }
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return {
        isSuccess: false,
        error: {
          type: 'SERVER_ERROR',
          message: ERROR_MESSAGES.SERVER_NON_JSON,
        },
      }
    }

    const data = await response.json()

    // Backend returns a filter response with exactly one problem (pageSize: 1)
    // The problem is guaranteed to exist because 404 is handled above
    const problem = data.problems.items[0]

    // Create filters based on the specific problem's metadata
    const source = problem.source
    let selection: ContestSelection | null = null
    if (source) {
      if (source.round) {
        selection = {
          type: 'round',
          competitionSlug: source.competition.slug,
          categorySlug: source.category?.slug,
          roundSlug: source.round.slug,
          displayName: source.round.displayName,
          fullName: source.round.fullName,
        }
      } else if (source.category) {
        selection = {
          type: 'category',
          competitionSlug: source.competition.slug,
          categorySlug: source.category.slug,
          displayName: source.category.displayName,
          fullName: source.category.fullName,
        }
      } else {
        selection = {
          type: 'competition',
          competitionSlug: source.competition.slug,
          displayName: source.competition.displayName,
          fullName: source.competition.fullName,
        }
      }
    }
    const filters: SearchFiltersState = {
      searchText: '',
      searchInSolution: false,
      seasons: problem.source?.season ? [problem.source.season] : [],
      contestSelection: selection ? [selection] : [],
      problemNumbers: problem.source?.number ? [problem.source.number] : [],
      tags: [],
      tagLogic: 'or',
      authors: [],
      authorLogic: 'or',
    }

    // Create the result structure expected by the page
    const result: SingleProblemResult = {
      problem,
      filters,
      options: data.updatedOptions || {
        competitions: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      },
    }

    return {
      isSuccess: true,
      value: result,
    }
  } catch (error) {
    // Handle null/undefined errors more gracefully
    const errorMessage =
      error instanceof Error ? error.message : error?.toString() || ERROR_MESSAGES.UNEXPECTED_ERROR
    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: errorMessage,
      },
    }
  }
}

/**
 * Fetches initial filter data for the problem library.
 * Returns empty problem list with all available filter options.
 */
export async function getInitialFilterData(): Promise<
  { isSuccess: true; value: FilterResponse } | { isSuccess: false; error: ProblemError }
> {
  try {
    const apiUrl = getProblemsFilterApiUrl()

    // Fetch initial data with empty filters to get all filter options
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parameters: {
          searchText: '',
          searchInSolution: false,
          olympiadYears: [],
          contests: [],
          problemNumbers: [],
          tagSlugs: [],
          tagLogic: 'or',
          authorSlugs: [],
          authorLogic: 'or',
        },
        pageSize: 20,
        pageNumber: 1,
      }),
    })

    if (!response.ok) {
      return {
        isSuccess: false,
        error: {
          type: 'NETWORK_ERROR',
          message: ERROR_MESSAGES.NETWORK_ERROR(response.status, response.statusText),
          status: response.status,
        },
      }
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return {
        isSuccess: false,
        error: {
          type: 'SERVER_ERROR',
          message: ERROR_MESSAGES.SERVER_NON_JSON,
        },
      }
    }

    const data = await response.json()

    const result: FilterResponse = {
      problems: data.problems,
      updatedOptions: data.updatedOptions || {
        competitions: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      },
    }

    return {
      isSuccess: true,
      value: result,
    }
  } catch (error) {
    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : ERROR_MESSAGES.UNEXPECTED_ERROR,
      },
    }
  }
}

/**
 * Searches for problems based on the provided filters.
 * Returns filtered problems and updated filter options.
 */
export async function searchProblems(
  filters: SearchFiltersState,
  pageSize: number,
  pageNumber: number,
  signal?: AbortSignal
): Promise<{ isSuccess: true; value: FilterResponse } | { isSuccess: false; error: ProblemError }> {
  try {
    const apiUrl = getProblemsFilterApiUrl()

    // Convert frontend filters to backend format
    const filterParameters = searchFiltersStateToFilterParameters(filters)

    // Search for problems with the provided filters
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parameters: filterParameters,
        pageSize,
        pageNumber,
      }),
      signal,
    })

    if (!response.ok) {
      return {
        isSuccess: false,
        error: {
          type: 'NETWORK_ERROR',
          message: ERROR_MESSAGES.NETWORK_ERROR(response.status, response.statusText),
          status: response.status,
        },
      }
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return {
        isSuccess: false,
        error: {
          type: 'SERVER_ERROR',
          message: ERROR_MESSAGES.SERVER_NON_JSON,
        },
      }
    }

    const data = await response.json()

    const result: FilterResponse = {
      problems: data.problems,
      updatedOptions: data.updatedOptions || null,
    }

    return {
      isSuccess: true,
      value: result,
    }
  } catch (error) {
    // Abort errors are intentional (user navigated away) - let them bubble up
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : ERROR_MESSAGES.UNEXPECTED_ERROR,
      },
    }
  }
}

/**
 * Converts SearchFiltersState to FilterParameters by extracting only the data needed for filtering.
 * Removes UI-specific LabeledSlug objects and converts them to the core identifiers.
 */
function searchFiltersStateToFilterParameters(state: SearchFiltersState): FilterParameters {
  // Extract olympiad edition numbers from LabeledSlug objects
  const olympiadYears = state.seasons
    .map((season) => {
      const editionNumber = parseInt(season.slug, 10)
      return isNaN(editionNumber) ? null : editionNumber
    })
    .filter((editionNumber): editionNumber is number => editionNumber !== null)

  // Extract tag slugs from LabeledSlug objects
  const tagSlugs = state.tags.map((tag) => tag.slug)

  // Extract author slugs from LabeledSlug objects
  const authorSlugs = state.authors.map((author) => author.slug)

  // Convert frontend ContestSelection to backend ContestSelection
  const contests: FilterParameters['contests'] = state.contestSelection.map((selection) => ({
    competitionSlug: selection.competitionSlug,
    categorySlug: selection.categorySlug,
    roundSlug: selection.roundSlug,
  }))

  return {
    searchText: state.searchText,
    searchInSolution: state.searchInSolution,
    olympiadYears,
    contests,
    problemNumbers: state.problemNumbers,
    tagSlugs,
    tagLogic: state.tagLogic,
    authorSlugs,
    authorLogic: state.authorLogic,
  }
}
