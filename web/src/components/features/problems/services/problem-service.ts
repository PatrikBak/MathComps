import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { FilterParameters, FilterQuery } from '../types/problem-api-types'
import type {
  CompetitionSelection,
  FilterResponse,
  FilterResult,
  ProblemFilterResponse,
  SearchFiltersState,
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
 * How many problems the library asks for while booting. It reads the facet counts off that answer,
 * and hands the page itself to the problem store.
 */
const INITIAL_PAGE_SIZE = 20

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
  const result = await apiCall<FilterResult>(() => getProblemBySlugApiUrl(slug), {
    method: 'GET',
  })

  // Pass a failure through untouched
  if (!result.success) return result

  // The one problem the slug names
  const problem = result.data.problems.items.at(0)

  // An empty page means the slug matched no problem
  if (!problem) {
    // Fail as a missing problem
    return problemNotFound('the response held no problem')
  }

  // The competition the problem was set in, which is the deepest one on the chain down to it
  const competition = problem.source.competition.at(-1)

  // A problem hangs off a competition at whatever depth it sits, so an empty chain is a payload the
  // archive cannot produce. Refused rather than trusted, since this is where the wire is read.
  if (!competition) {
    // Fail as a problem that cannot be shown
    return problemNotFound('the problem source named no competition')
  }

  // The filter stands at that competition, whose slug is the whole path down to it
  const selection: CompetitionSelection = { path: competition.slug }

  // Season, competition and position together pin down this one problem, so the rest stay empty
  const filters: SearchFiltersState = {
    ...createDefaultFilters(),
    seasons: [problem.source.season],
    competitionSelection: [selection],
    problemNumbers: [problem.source.number],
  }

  // The problem, its filters, and whatever options came back alongside them
  return {
    success: true,
    data: {
      problem,
      filters,
      options: result.data.updatedOptions || {
        competitions: [],
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
  // The whole archive, unnarrowed, which is what the library opens on
  return fetchFilterPage(apiCall, buildFilterQuery(createDefaultFilters(), INITIAL_PAGE_SIZE, 1))
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
  // The page those filters narrow to
  return fetchFilterPage(apiCall, buildFilterQuery(filters, pageSize, pageNumber), signal)
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
 * Runs one search against the filter endpoint and flattens the nesting off its answer, so a caller
 * reads the page, the option counts and the list name as one object.
 *
 * @param apiCall - The API caller function.
 * @param query - The search to run.
 * @param signal - The signal to abort the request, left off by a search nothing supersedes.
 *
 * @returns A promise resolving to the matching page of problems and updated options, or an error.
 */
async function fetchFilterPage(
  apiCall: ApiCaller,
  query: FilterQuery,
  signal?: AbortSignal
): Promise<ApiResult<FilterResponse>> {
  // Ask for the page the query names
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
      updatedOptions: result.data.filterResult.updatedOptions,
      listName: result.data.listName,
    },
  }
}

/**
 * Converts a {@link SearchFiltersState} and the slice being asked for into the {@link FilterQuery}
 * the API takes.
 *
 * @param state - The search filters to convert.
 * @param pageSize - The number of problems to return per page.
 * @param pageNumber - The page number to return.
 *
 * @returns The converted query.
 */
function buildFilterQuery(
  state: SearchFiltersState,
  pageSize: number,
  pageNumber: number
): FilterQuery {
  // The narrowings a signed-out visitor can ask for, alongside the ones that need a reader behind them
  return {
    parameters: searchFiltersStateToFilterParameters(state),
    pageSize,
    pageNumber,
    favoritesOnly: state.favoritesOnly,
    listContentId: state.listContentId,
    markStatus: state.markStatus,
  }
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
