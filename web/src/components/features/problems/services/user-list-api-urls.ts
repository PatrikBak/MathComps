import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the authenticated user's lists endpoints.
 */
const LISTS_PATH = '/users/me/lists'

/**
 * Builds the API URL for fetching the authenticated user's lists.
 *
 * @returns The API URL path for the user lists endpoint
 */
export function getUserListsApiUrl(): string {
  return buildApiUrl(LISTS_PATH)
}

/**
 * Builds the API URL for adding or removing a problem from a list.
 * Used with POST (add) and DELETE (remove).
 *
 * @param contentId - The content ID of the target list
 * @param problemSlug - The slug of the problem
 *
 * @returns The API URL path for the list item endpoint
 */
export function getListItemApiUrl(contentId: string, problemSlug: string): string {
  return buildApiUrl(
    `${LISTS_PATH}/${encodeURIComponent(contentId)}/problems/${encodeURIComponent(problemSlug)}`
  )
}

/**
 * Builds the API URL for a single list (rename or delete).
 *
 * @param contentId - The content ID of the target list
 *
 * @returns The API URL path for the single list endpoint
 */
export function getListApiUrl(contentId: string): string {
  return buildApiUrl(`${LISTS_PATH}/${encodeURIComponent(contentId)}`)
}

/**
 * Builds the API URL for bulk reordering lists.
 *
 * @returns The API URL path for the list order endpoint
 */
export function getListOrderApiUrl(): string {
  return buildApiUrl(`${LISTS_PATH}/order`)
}

/**
 * Builds the API URL for enabling or disabling sharing on a list.
 * Used with POST (enable) and DELETE (disable).
 *
 * @param contentId - The content ID of the target list
 *
 * @returns The API URL path for the list share endpoint
 */
export function getListShareApiUrl(contentId: string): string {
  return buildApiUrl(`${LISTS_PATH}/${encodeURIComponent(contentId)}/share`)
}
