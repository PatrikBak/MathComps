import { buildApiUrl, getApiBaseUrl, getR2BaseUrl } from '@/components/shared/utils/url-utils'
import { ROUTES } from '@/i18n/i18n'

/**
 * The suffix for the URL endpoint for images for different types of content.
 */
export type ImageType = 'problems' | 'handouts'

/**
 * Builds a public URL to a problem image by its content id.
 * Handout images are served from Cloudflare R2, problem images from the backend API.
 *
 * @param contentId - The unique identifier of the problem content/image
 * @param type - The type of the image (problems or handouts)
 * @returns The URL to the image
 */
export function getProblemImageUrl(contentId: string, type: ImageType): string {
  switch (type) {
    case 'handouts':
      return `${getR2BaseUrl()}/handouts/${contentId}`
    case 'problems':
      return `${getApiBaseUrl()}/images/${type}/${contentId}`
  }
}

/**
 * Builds a public URL to a handout PDF by its filename. The handout's
 * language-stripped slug is derived from the filename — both `<slug>.<lang>.pdf`
 * and `<slug>.<lang>-skeleton.pdf` collapse to the same slug so every artefact
 * lives in one folder on R2.
 *
 * @param filename - The PDF filename (e.g., "factorization.sk.pdf")
 * @returns The public URL to the PDF on R2
 */
export function getHandoutPdfUrl(filename: string): string {
  const slug = filename.replace(/\.[a-z]{2}(-skeleton)?\.pdf$/i, '')
  return `${getR2BaseUrl()}/handouts/${slug}/${filename}`
}

/**
 * Builds the API URL for downloading a document asset by its identifier.
 *
 * @param documentId - The unique identifier of the document asset
 * @returns The API URL path to the document asset
 */
export function getDocumentUrl(documentId: string): string {
  return `${getApiBaseUrl()}/documents/${documentId}`
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
 * Builds the API URL for toggling a mark on a problem by its slug.
 *
 * @param slug - The problem slug
 * @returns The API URL path to toggle the mark
 */
export function getToggleProblemMarkApiUrl(slug: string): string {
  return buildApiUrl(`/problems/${slug}/mark`)
}

/**
 * Builds the API URL for fetching contests grouped by season.
 *
 * @returns The API URL path for the contests-by-season endpoint
 */
export function getContestsBySeasonApiUrl(): string {
  return buildApiUrl('/problems/contests-by-season')
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
