/**
 * Key used to store the slug of a problem that the user attempted to like while unauthenticated.
 * Used to restore the action after login.
 */
export const PENDING_PROBLEM_LIKE_STORAGE_KEY = 'pending-problem-like'

/**
 * Key used to store the slug of a problem that the user attempted to mark while unauthenticated.
 * Used to restore the action after login.
 */
export const PENDING_PROBLEM_MARK_STORAGE_KEY = 'pending-problem-mark'

/**
 * Key used to store the id of a comment that the user attempted to like while unauthenticated.
 * Used to restore the action after login.
 */
export const PENDING_COMMENT_LIKE_STORAGE_KEY = 'pending-comment-like'

/**
 * Key used to store the user's preference for showing technique tags in the problems library.
 * Currently uses localStorage, i.e. it is not user-specific for now.
 */
export const SHOW_TECHNIQUE_TAGS_STORAGE_KEY = 'showTechniqueTags'

/**
 * Key used to store the user's preference for keeping the screen awake while reading handouts.
 * Currently uses localStorage, i.e. it is not user-specific for now.
 */
export const KEEP_SCREEN_ON_STORAGE_KEY = 'keepScreenOn'

/**
 * Key used to store the return URL during the authentication flow (persists through redirects).
 * Note: This is used with sessionStorage.
 */
export const AUTH_RETURN_URL_STORAGE_KEY = 'auth_return_url'

/**
 * Key used to store the comment target (news/problem) that the user was viewing
 * when they were prompted to log in. Used to re-open the comment modal.
 */
export const PENDING_COMMENT_TARGET_STORAGE_KEY = 'pending-comment-target'

/**
 * Prefix under which a competition problem's unsent composer text is kept, so a half-written solution
 * survives closing the chat or reloading the page. The rest of the key names the problem; see
 * {@link defenseDraftStorageKey}.
 */
export const DEFENSE_DRAFT_STORAGE_PREFIX = 'defense-draft'
