import { ROUTES } from '@/i18n/i18n'

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
