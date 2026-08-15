import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { FilterParameters, FilterQuery } from '../types/problem-api-types'
import type {
  FilterResponse,
  ProblemFilterResponse,
  SearchFiltersState,
  SingleProblemResponse,
  SingleProblemResult,
} from '../types/problem-library-types'
import { createDefaultFilters } from '../utils/url-initialization'
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
 * @param includeBaseOptions - Whether to ask for the whole library's options alongside the problem's own.
 *
 * @returns A promise resolving to the single problem with its derived filters, or an error.
 */
export async function getProblemBySlug(
  apiCall: ApiCaller,
  slug: string,
  includeBaseOptions: boolean
): Promise<ApiResult<SingleProblemResult>> {
  // Fetch the problem
  const result = await apiCall<SingleProblemResponse>(
    () => getProblemBySlugApiUrl(slug, includeBaseOptions),
    { method: 'GET' }
  )

  // Pass a failure through untouched
  if (!result.success) return result

  // The page the problem was served on, and where the archive found it
  const { filterResult, filters: position } = result.data

  // The one problem the slug names
  const problem = filterResult.problems.items.at(0)

  // An empty page means the slug matched no problem
  if (!problem) {
    // Fail as a missing problem
    return problemNotFound('the response held no problem')
  }

  // The filters below pin down this one problem, so its own counts are always owed
  if (!filterResult.updatedOptions) {
    // Refused rather than shown with every count reading nought
    return problemNotFound('the answer carried no option counts')
  }

  // The season as a filter addresses it, which is its edition number
  const seasonSlug = String(position.season)

  // Season, competition and position together pin down this one problem, so the rest stay empty
  const filters: SearchFiltersState = {
    ...createDefaultFilters(),
    seasons: [{ slug: seasonSlug, displayName: seasonSlug, fullName: null }],
    competitionSelection: [{ path: position.competitionPath }],
    problemNumbers: [position.problemNumber],
  }

  // The problem, its filters, and the options they are picked from
  return {
    success: true,
    data: {
      problem,
      filters,
      baseOptions: filterResult.baseOptions,
      options: filterResult.updatedOptions,
    },
  }
}

/**
 * Searches for problems based on the provided filters, flattening the nesting off the answer so a
 * caller reads the page, the option counts and the list name as one object.
 *
 * @param apiCall - The API caller function.
 * @param filters - The filters to apply to the search.
 * @param pageSize - The number of problems to return per page.
 * @param pageNumber - The page number to return.
 * @param includeBaseOptions - Whether to ask for the whole library's options alongside this search's own.
 * @param signal - The signal to abort the request.
 *
 * @returns A promise resolving to the matching page of problems and updated options, or an error.
 */
export async function searchProblems(
  apiCall: ApiCaller,
  filters: SearchFiltersState,
  pageSize: number,
  pageNumber: number,
  includeBaseOptions: boolean,
  signal: AbortSignal
): Promise<ApiResult<FilterResponse>> {
  // The search as the API takes it: the narrowings a signed-out visitor can ask for, the ones that
  // need a reader behind them, and the slice of the matches to serve
  const query: FilterQuery = {
    parameters: searchFiltersStateToFilterParameters(filters),
    pageSize,
    pageNumber,
    favoritesOnly: filters.favoritesOnly,
    listContentId: filters.listContentId,
    markStatus: filters.markStatus,
    includeBaseOptions,
  }

  // Ask for the page those filters narrow to
  const result = await apiCall<ProblemFilterResponse>(() => getProblemsFilterApiUrl(), {
    method: 'POST',
    body: JSON.stringify(query),
    signal,
  })

  // Pass a failure through untouched
  if (!result.success) return result

  // The page and its options, with the list they were browsed under lifted up beside them
  return {
    success: true,
    data: {
      problems: result.data.filterResult.problems,
      baseOptions: result.data.filterResult.baseOptions,
      updatedOptions: result.data.filterResult.updatedOptions,
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
  // The editions filtered on, which the API knows as olympiad years. A season's slug is its edition
  // number, and a URL naming anything else is refused before it ever becomes a filter.
  const olympiadYears = state.seasons.map((season) => Number(season.slug))

  // The tags filtered on
  const tagSlugs = state.tags.map((tag) => tag.slug)

  // The authors filtered on
  const authorSlugs = state.authors.map((author) => author.slug)

  // The competitions filtered on, each named by the path standing for it and everything under it
  const competitionPaths = state.competitionSelection.map((selection) => selection.path)

  // The reduced lists alongside the fields that pass through untouched
  return {
    searchText: state.searchText,
    searchInSolution: state.searchInSolution,
    olympiadYears,
    competitionPaths,
    problemNumbers: state.problemNumbers,
    tagSlugs,
    tagLogic: state.tagLogic,
    authorSlugs,
    authorLogic: state.authorLogic,
  }
}

/**
 * The failure the archive answers with when it cannot show the problem a slug named. What the reader
 * is told is resolved from the code; the detail only ever reaches a console.
 *
 * @param detail - What was missing.
 *
 * @returns The failure.
 */
function problemNotFound(detail: string): ApiResult<never> {
  // A slug the archive cannot show is the same outcome however it fell short
  return {
    success: false,
    error: {
      message: `Cannot show the problem: ${detail}`,
      statusCode: 404,
      errorCode: 'ProblemNotFound',
    },
  }
}
