import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { ROUTES } from '@/constants/routes'

/**
 * Retrieves the base API URL from environment variables.
 *
 * @returns The base API URL with no trailing slash
 */
function getApiBaseUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_API_URL')
}

/**
 * Retrieves the public site URL from environment variables.
 *
 * @returns The site URL with no trailing slash
 */
export function getSiteUrl(): string {
  return getRequiredEnv('NEXT_PUBLIC_SITE_URL')
}

/**
 * Builds API URL for the given endpoint path.
 *
 * Development: Uses /api prefix which Next.js strips via rewrites
 * Production: Uses direct backend URL without /api prefix
 *
 * @param path - The endpoint path
 * @returns The full API URL for the endpoint
 */
function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  // Production: use backend URL directly (no /api prefix on backend)
  // Development: use /api prefix which Next.js rewrites to strip it
  return baseUrl ? `${baseUrl}${path}` : `/api${path}`
}

/**
 * Builds a public URL to a problem image by its content id.
 *
 * @param contentId - The unique identifier of the problem content/image
 * @returns The API URL path to the problem image
 */
export function getProblemImageUrl(contentId: string): string {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/images/problems/${contentId}`
}

/**
 * Builds the API URL for fetching a single problem by its slug.
 * The slug is URL-encoded to handle special characters safely.
 *
 * @param slug - The problem slug identifier (will be URL-encoded automatically)
 * @returns The API URL path to fetch the problem
 */
export function getProblemBySlugApiUrl(slug: string): string {
  return buildApiUrl(`/problems/${encodeURIComponent(slug)}`)
}

/**
 * Builds the API URL for filtering and searching problems.
 * This endpoint accepts POST requests with filter parameters.
 *
 * @returns The API URL path for the problems filter endpoint
 */
export function getProblemsFilterApiUrl(): string {
  return buildApiUrl('/problems/filter')
}

/**
 * Builds the frontend URL for the problems page with optional query parameters.
 * If queryString is empty, returns the base problems URL without a query string.
 *
 * @param queryString - Optional query string with filters (without leading '?')
 * @returns The frontend URL path to the problems page, with or without query parameters
 */
export function getProblemsPageUrl(queryString?: string): string {
  return queryString ? `${ROUTES.PROBLEMS}?${queryString}` : ROUTES.PROBLEMS
}
