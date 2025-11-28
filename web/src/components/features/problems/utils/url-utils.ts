import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { ROUTES } from '@/constants/routes'

/**
 * The suffix for the URL endpoint for images for different types of content.
 */
export type ImageType = 'problems' | 'handouts'

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
 * @param type - The type of the image (problems or handouts)
 * @returns The API URL path to the problem image
 */
export function getProblemImageUrl(contentId: string, type: ImageType): string {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/images/${type}/${contentId}`
}

/**
 * Builds the API URL for downloading a document asset by its identifier.
 *
 * @param documentId - The unique identifier of the document asset
 * @returns The API URL path to the document asset
 */
export function getDocumentUrl(documentId: string): string {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/documents/${documentId}`
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
 * Builds the API URL for toggling a like on a problem by its slug.
 *
 * @param slug - The problem slug
 * @returns The API URL path to toggle the like
 */
export function getToggleProblemLikeApiUrl(slug: string): string {
  return buildApiUrl(`/problems/${slug}/like`)
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

/**
 * Checks if the URL contains a problem ID parameter.
 *
 * @param searchParams - The URL search parameters to check
 * @returns True if the URL contains a problem ID parameter, false otherwise
 */
export function hasProblemId(searchParams: URLSearchParams): boolean {
  return searchParams.has('id') && searchParams.get('id') !== null && searchParams.get('id') !== ''
}
