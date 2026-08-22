import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * Path the authenticated user's own profile lives at.
 */
const PROFILE_PATH = '/users/me/profile'

/**
 * Path the authenticated user's username lives at.
 */
const USERNAME_PATH = '/users/me/username'

/**
 * Builds the URL for reading the authenticated user's profile.
 *
 * @returns The absolute profile URL.
 */
export function getUserProfileUrl(): string {
  return buildApiUrl(PROFILE_PATH)
}

/**
 * Builds the URL for taking the authenticated user's username.
 *
 * @returns The absolute username URL.
 */
export function getSetUsernameUrl(): string {
  return buildApiUrl(USERNAME_PATH)
}
