import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { FilterParameters } from '../types/problem-api-types'
import type {
  ContestSelection,
  FilterResponse,
  RawProblemFilterResponse,
  SearchFiltersState,
  SingleProblemResult,
} from '../types/problem-library-types'
import {
  getProblemBySlugApiUrl,
  getProblemsFilterApiUrl,
  getToggleProblemLikeApiUrl,
  getToggleProblemMarkApiUrl,
} from './problem-api-urls'

/**
 * Fetches a single problem by its slug from the API.
 *
 * @param apiCall - The API caller function.
 * @param slug - The slug of the problem to fetch.
 *
 * @returns A promise resolving to the single problem with its derived filters, or an error.
 */
export async function getProblemBySlug(
  apiCall: ApiCaller,
  slug: string
): Promise<ApiResult<SingleProblemResult>> {
  // Fetch the problem
  const result = await apiCall<FilterResponse>(() => getProblemBySlugApiUrl(slug), {
    method: 'GET',
  })

  // Pass a failure through untouched
  if (!result.success) return result

  // The one problem the slug names
  const problem = result.data.problems.items.at(0)

  // An empty page means the slug matched no problem
  if (!problem) {
    // Fail as a missing problem
    return {
      success: false,
      error: {
        message: 'Problem response contained no items',
        statusCode: 404,
        errorCode: 'ProblemNotFound',
      },
    }
  }

  // The contest the problem was set in, which is the deepest one on the chain down to it
  const contest = problem.source.contest.at(-1)

  // A problem hanging off no contest at all cannot be placed in the library
  if (!contest) {
    // Fail as a problem that cannot be shown
    return {
      success: false,
      error: {
        message: 'Problem source named no contest',
        statusCode: 404,
        errorCode: 'ProblemNotFound',
      },
    }
  }

  // The filter stands at that contest, whose slug is the whole path down to it
  const selection: ContestSelection = { path: contest.slug }

  // Season, contest and position together pin down this one problem, so the rest stay empty
  const filters: SearchFiltersState = {
    searchText: '',
    searchInSolution: false,
    seasons: [problem.source.season],
    contestSelection: [selection],
    problemNumbers: [problem.source.number],
    tags: [],
    tagLogic: 'or',
    authors: [],
    authorLogic: 'or',
    favoritesOnly: false,
    markStatus: null,
    listContentId: null,
  }

  // The problem, its filters, and whatever options came back alongside them
  return {
    success: true,
    data: {
      problem,
      filters,
      options: result.data.updatedOptions || {
        contests: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      },
    },
  }
}

/**
 * Fetches initial filter data for the problem library.
 *
 * @param apiCall - The API caller function.
 *
 * @returns A promise resolving to the base filter options and first page of problems, or an error.
 */
export async function getInitialFilterData(apiCall: ApiCaller): Promise<ApiResult<FilterResponse>> {
  // Fetch the raw filter response
  const result = await apiCall<RawProblemFilterResponse>(() => getProblemsFilterApiUrl(), {
    method: 'POST',
    body: JSON.stringify({
      parameters: {
        searchText: '',
        searchInSolution: false,
        olympiadYears: [],
        contestPaths: [],
        problemNumbers: [],
        tagSlugs: [],
        tagLogic: 'or',
        authorSlugs: [],
        authorLogic: 'or',
      } satisfies FilterParameters,
      pageSize: 20,
      pageNumber: 1,
      favoritesOnly: false,
      markStatus: null,
      listContentId: null,
    }),
  })

  // Pass a failure through untouched
  if (!result.success) return result

  // The first page of problems, alongside the options and the list it was browsed under
  return {
    success: true,
    data: {
      problems: result.data.filterResult.problems,
      updatedOptions: result.data.filterResult.updatedOptions,
      listName: result.data.listName,
    },
  }
}

/**
 * Searches for problems based on the provided filters.
 *
 * @param apiCall - The API caller function.
 * @param filters - The filters to apply to the search.
 * @param pageSize - The number of problems to return per page.
 * @param pageNumber - The page number to return.
 * @param signal - The signal to abort the request.
 *
 * @returns A promise resolving to the matching page of problems and updated options, or an error.
 */
export async function searchProblems(
  apiCall: ApiCaller,
  filters: SearchFiltersState,
  pageSize: number,
  pageNumber: number,
  signal: AbortSignal
): Promise<ApiResult<FilterResponse>> {
  // The filters as the API takes them
  const filterParameters = searchFiltersStateToFilterParameters(filters)

  // Fetch the raw filter response
  const result = await apiCall<RawProblemFilterResponse>(() => getProblemsFilterApiUrl(), {
    method: 'POST',
    body: JSON.stringify({
      parameters: filterParameters,
      pageSize,
      pageNumber,
      favoritesOnly: filters.favoritesOnly,
      markStatus: filters.markStatus,
      listContentId: filters.listContentId,
    }),
    signal,
  })

  // Pass a failure through untouched
  if (!result.success) return result

  // The matching page of problems, alongside the options and the list it was browsed under
  return {
    success: true,
    data: {
      problems: result.data.filterResult.problems,
      updatedOptions: result.data.filterResult.updatedOptions || null,
      listName: result.data.listName,
    },
  }
}

/**
 * Toggles a user's like on a problem.
 *
 * @param apiCall - The API caller function.
 * @param slug - The slug of the problem to toggle the like for.
 *
 * @returns A promise resolving to success or an error.
 */
export async function toggleProblemLike(
  apiCall: ApiCaller,
  slug: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getToggleProblemLikeApiUrl(slug), {
    method: 'POST',
  })
}

/**
 * Toggles a user's mark on a problem.
 *
 * @param apiCall - The API caller function.
 * @param slug - The slug of the problem to toggle the mark for.
 *
 * @returns A promise resolving to success or an error.
 */
export async function toggleProblemMark(
  apiCall: ApiCaller,
  slug: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getToggleProblemMarkApiUrl(slug), {
    method: 'POST',
  })
}

/**
 * Converts a {@link SearchFiltersState} into the {@link FilterParameters} the API takes,
 * with every named value reduced to the identifier the API knows it by.
 *
 * @param state - The search filters to convert.
 *
 * @returns The converted filter parameters.
 */
function searchFiltersStateToFilterParameters(state: SearchFiltersState): FilterParameters {
  // The editions filtered on, which the API knows as olympiad years
  const olympiadYears = state.seasons
    .map((season) => {
      // The edition the season's slug names
      const editionNumber = parseInt(season.slug, 10)

      // Dropped when the slug is not an edition number
      return isNaN(editionNumber) ? null : editionNumber
    })
    .filter((editionNumber): editionNumber is number => editionNumber !== null)

  // The tags filtered on
  const tagSlugs = state.tags.map((tag) => tag.slug)

  // The authors filtered on
  const authorSlugs = state.authors.map((author) => author.slug)

  // The contests filtered on, each named by the path standing for it and everything under it
  const contestPaths = state.contestSelection.map((selection) => selection.path)

  // The reduced lists alongside the fields that pass through untouched
  return {
    searchText: state.searchText,
    searchInSolution: state.searchInSolution,
    olympiadYears,
    contestPaths,
    problemNumbers: state.problemNumbers,
    tagSlugs,
    tagLogic: state.tagLogic,
    authorSlugs,
    authorLogic: state.authorLogic,
  }
}
