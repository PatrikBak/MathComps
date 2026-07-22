import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the problems endpoints.
 */
const PROBLEMS_PATH = '/problems'

/**
 * Builds the API URL for fetching a single problem by its slug.
 * The slug is URL-encoded to handle special characters safely.
 *
 * @param slug - The problem slug identifier (will be URL-encoded automatically)
 * @returns The API URL path to fetch the problem
 */
export function getProblemBySlugApiUrl(slug: string): string {
  return buildApiUrl(`${PROBLEMS_PATH}/${encodeURIComponent(slug)}`)
}

/**
 * Builds the API URL for filtering and searching problems.
 * This endpoint accepts POST requests with filter parameters.
 *
 * @returns The API URL path for the problems filter endpoint
 */
export function getProblemsFilterApiUrl(): string {
  return buildApiUrl(`${PROBLEMS_PATH}/filter`)
}

/**
 * Builds the API URL for toggling a like on a problem by its slug.
 *
 * @param slug - The problem slug
 * @returns The API URL path to toggle the like
 */
export function getToggleProblemLikeApiUrl(slug: string): string {
  return buildApiUrl(`${PROBLEMS_PATH}/${encodeURIComponent(slug)}/like`)
}

/**
 * Builds the API URL for toggling a mark on a problem by its slug.
 *
 * @param slug - The problem slug
 * @returns The API URL path to toggle the mark
 */
export function getToggleProblemMarkApiUrl(slug: string): string {
  return buildApiUrl(`${PROBLEMS_PATH}/${encodeURIComponent(slug)}/mark`)
}

/**
 * Builds the API URL for fetching contests grouped by season.
 *
 * @returns The API URL path for the contests-by-season endpoint
 */
export function getContestsBySeasonApiUrl(): string {
  return buildApiUrl(`${PROBLEMS_PATH}/contests-by-season`)
}
