import type { ApiCaller } from '@/hooks/use-api'
import { wrapApi } from '@/lib/api-utils'
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
  return wrapApi(
    apiCall<FilterResponse>(() => getProblemBySlugApiUrl(slug), {
      method: 'GET',
    }),
    (data) => {
      // On success the backend returns a filter response with exactly one problem (pageSize: 1)
      const problem = data.problems.items[0]

      // We will create filters based on the specific problem's metadata
      let selection: ContestSelection | null = null

      // The source information is key to determine the contest selection
      const source = problem.source
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

      // Create the filters that should resolve into this exact problem
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [problem.source.season],
        contestSelection: selection ? [selection] : [],
        problemNumbers: [problem.source.number],
        tags: [],
        tagLogic: 'or',
        authors: [],
        authorLogic: 'or',
        favoritesOnly: false,
        markStatus: null,
        listContentId: null,
      }

      // Return the filters
      return {
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
    }
  )
}

/**
 * Fetches initial filter data for the problem library.
 *
 * @param apiCall - The API caller function.
 *
 * @returns A promise resolving to the base filter options and first page of problems, or an error.
 */
export async function getInitialFilterData(apiCall: ApiCaller): Promise<ApiResult<FilterResponse>> {
  return wrapApi(
    apiCall<RawProblemFilterResponse>(() => getProblemsFilterApiUrl(), {
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
        markStatus: null,
        listContentId: null,
      }),
    }),
    // Flatten the nested response into the frontend FilterResponse shape
    (data) => ({
      problems: data.filterResult.problems,
      updatedOptions: data.filterResult.updatedOptions || {
        competitions: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      },
      listName: data.listName,
    })
  )
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
  // Convert frontend filters to backend format
  const filterParameters = searchFiltersStateToFilterParameters(filters)

  // Perform the API call
  return wrapApi(
    apiCall<RawProblemFilterResponse>(() => getProblemsFilterApiUrl(), {
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
    }),
    // Flatten the nested response into the frontend FilterResponse shape
    (data) => ({
      problems: data.filterResult.problems,
      updatedOptions: data.filterResult.updatedOptions || null,
      listName: data.listName,
    })
  )
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
