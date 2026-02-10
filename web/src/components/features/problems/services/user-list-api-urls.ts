import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * Builds the API URL for fetching the authenticated user's lists.
 *
 * @returns The API URL path for the user lists endpoint
 */
export function getUserListsApiUrl(): string {
  return buildApiUrl('/users/me/lists')
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
  return buildApiUrl(`/users/me/lists/${contentId}/problems/${problemSlug}`)
}

/**
 * Builds the API URL for a single list (rename or delete).
 *
 * @param contentId - The content ID of the target list
 *
 * @returns The API URL path for the single list endpoint
 */
export function getListApiUrl(contentId: string): string {
  return buildApiUrl(`/users/me/lists/${contentId}`)
}

/**
 * Builds the API URL for bulk reordering lists.
 *
 * @returns The API URL path for the list order endpoint
 */
export function getListOrderApiUrl(): string {
  return buildApiUrl('/users/me/lists/order')
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
  return buildApiUrl(`/users/me/lists/${contentId}/share`)
}
