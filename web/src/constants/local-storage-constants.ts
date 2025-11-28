/**
 * Keys used for localStorage and sessionStorage.
 */

/**
 * Key used to store the slug of a problem that the user attempted to like while unauthenticated.
 * Used to restore the action after login.
 */
export const PENDING_PROBLEM_LIKE_STORAGE_KEY = 'pending-problem-like'

/**
 * Key used to store the user's preference for showing technique tags in the problems library.
 */
export const SHOW_TECHNIQUE_TAGS_STORAGE_KEY = 'showTechniqueTags'

/**
 * Key used to store the return URL during the authentication flow (persists through redirects).
 * Note: This is used with sessionStorage.
 */
export const AUTH_RETURN_URL_STORAGE_KEY = 'auth_return_url'
