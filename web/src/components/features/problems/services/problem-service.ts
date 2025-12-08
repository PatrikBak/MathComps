import type { ApiCaller } from '@/hooks/use-api'

import type { FilterParameters } from '../types/problem-api-types'
import type { ProblemNotFoundError, ServiceResult } from '../types/problem-errors'
import type {
  ContestSelection,
  FilterResponse,
  SearchFiltersState,
  SingleProblemResult,
} from '../types/problem-library-types'
import {
  getProblemBySlugApiUrl,
  getProblemsFilterApiUrl,
  getToggleProblemLikeApiUrl,
} from '../utils/url-utils'

/**
 * Fetches a single problem by its slug from the API.
 *
 * @param apiCall - The API caller function.
 * @param slug - The slug of the problem to fetch.
 *
 * @returns A promise that resolves to a {@link ServiceResult} containing the {@link SingleProblemResult}
 *          if the request is successful, or a {@link ProblemError} if the request fails.
 */
export async function getProblemBySlug(
  apiCall: ApiCaller,
  slug: string
): Promise<ServiceResult<SingleProblemResult>> {
  // Fetch the problem by slug
  const result = await apiCall<FilterResponse>(() => getProblemBySlugApiUrl(slug), {
    method: 'GET',
  })

  // Handle incorrect response
  if (!result.success) {
    // Handle 404 not found
    if (result.error.type === 'network' && result.error.statusCode === 404) {
      return {
        isSuccess: false,
        error: {
          type: 'PROBLEM_NOT_FOUND',
          slug,
          message: 'Problem not found',
        } as ProblemNotFoundError,
      }
    }

    // Handle generic error, assume network error
    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: result.error.message,
      },
    }
  }

  // Backend returns a filter response with exactly one problem (pageSize: 1)
  // The problem is guaranteed to exist because 404 is handled above
  const problem = result.data.problems.items[0]

  // Create filters based on the specific problem's metadata
  const source = problem.source
  let selection: ContestSelection | null = null
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
  } else if (source.competition) {
    selection = {
      type: 'competition',
      competitionSlug: source.competition.slug,
      displayName: source.competition.displayName,
      fullName: source.competition.fullName,
    }
  }

  // Create filters
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
    favoritesOnly: false,
  }

  // Create the result structure expected by the page
  const resultValue: SingleProblemResult = {
    problem,
    filters,
    options: result.data.updatedOptions || {
      competitions: [],
      seasons: [],
      problemNumbers: [],
      tags: [],
      authors: [],
    },
  }

  // Return success
  return {
    isSuccess: true,
    value: resultValue,
  }
}

/**
 * Fetches initial filter data for the problem library.
 *
 * @param apiCall - The API caller function.
 *
 * @returns A promise that resolves to a {@link ServiceResult} containing the filter data
 *          if the request is successful, or a {@link ProblemError} if the request fails.
 */
export async function getInitialFilterData(
  apiCall: ApiCaller
): Promise<ServiceResult<FilterResponse>> {
  // Fetch initial data with empty filters to get all filter options
  const result = await apiCall<FilterResponse>(() => getProblemsFilterApiUrl(), {
    method: 'POST',
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
      favoritesOnly: false,
    }),
  })

  // Handle incorrect response
  if (!result.success) {
    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: result.error.message,
      },
    }
  }

  // When response successful, we have non-null data
  const data = result.data

  // Create the result structure expected by the page
  const resultValue: FilterResponse = {
    problems: data.problems,
    updatedOptions: data.updatedOptions || {
      competitions: [],
      seasons: [],
      problemNumbers: [],
      tags: [],
      authors: [],
    },
  }

  // Return success
  return {
    isSuccess: true,
    value: resultValue,
  }
}

/**
 * Searches for problems based on the provided filters.
 *
 * @param apiCall - The API caller function.
 * @param filters - The search filters to apply.
 * @param pageSize - The number of problems to return per page.
 * @param pageNumber - The page number to return.
 * @param signal - An optional {@link AbortSignal} to cancel the request.
 *
 * @returns A promise that resolves to a {@link ServiceResult} containing the {@link FilterResponse}
 *          if the request is successful, or a {@link ProblemError} if the request fails.
 */
export async function searchProblems(
  apiCall: ApiCaller,
  filters: SearchFiltersState,
  pageSize: number,
  pageNumber: number,
  signal?: AbortSignal
): Promise<ServiceResult<FilterResponse>> {
  // Convert frontend filters to backend format
  const filterParameters = searchFiltersStateToFilterParameters(filters)

  // Search for problems with the provided filters
  const result = await apiCall<FilterResponse>(() => getProblemsFilterApiUrl(), {
    method: 'POST',
    body: JSON.stringify({
      parameters: filterParameters,
      pageSize,
      pageNumber,
      favoritesOnly: filters.favoritesOnly,
    }),
    signal,
  })

  // Handle incorrect response
  if (!result.success) {
    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: result.error.message,
      },
    }
  }

  // When response successful, we have non-null data
  const data = result.data

  // Create the result structure expected by the page
  const resultValue: FilterResponse = {
    problems: data.problems,
    updatedOptions: data.updatedOptions || null,
  }

  // Return success
  return {
    isSuccess: true,
    value: resultValue,
  }
}

/**
 * Converts SearchFiltersState to FilterParameters by extracting only the data needed for filtering.
 * Removes UI-specific LabeledSlug objects and converts them to the core identifiers.
 *
 * @param state - The search filters to convert.
 *
 * @returns The converted filter parameters.
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

  // Return the converted filter parameters
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

/**
 * Toggles a user's like on a problem.
 * Requires authentication - the Clerk token must be provided.
 *
 * @param slug - The problem slug to toggle like for
 * @param apiCall - The API caller function
 *
 * @returns A promise that resolves to a {@link ServiceResult} with nothing in it
 *          if the request is successful, or a {@link ProblemError} if the request fails.
 */
export async function toggleProblemLike(
  apiCall: ApiCaller,
  slug: string
): Promise<ServiceResult<void>> {
  // Call the API to toggle the like
  const result = await apiCall<void>(() => getToggleProblemLikeApiUrl(slug), {
    method: 'POST',
  })

  // Handle incorrect response
  if (!result.success) {
    return {
      isSuccess: false,
      error: {
        type: 'NETWORK_ERROR',
        message: result.error.message,
      },
    }
  }

  // Return success
  return {
    isSuccess: true,
    value: undefined,
  }
}
