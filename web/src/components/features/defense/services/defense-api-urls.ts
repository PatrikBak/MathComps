import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the defense sessions endpoints.
 */
const SESSIONS_PATH = '/defense/sessions'

/**
 * Builds the URL for listing a problem's defense sessions.
 *
 * @param problemKey - The stable key of the problem whose sessions to list.
 * @returns The list URL.
 */
export function getDefenseSessionsUrl(problemKey: string): string {
  // The list endpoint, filtered to the problem
  return buildApiUrl(SESSIONS_PATH, { problemKey })
}

/**
 * Builds the URL for listing all of the user's defense sessions across every problem.
 *
 * @returns The list URL.
 */
export function getMyDefenseSessionsUrl(): string {
  // The cross-problem list endpoint
  return buildApiUrl(`${SESSIONS_PATH}/mine`)
}

/**
 * Builds the URL for opening a new defense session.
 *
 * @returns The start URL.
 */
export function getStartDefenseUrl(): string {
  // The create endpoint
  return buildApiUrl(SESSIONS_PATH)
}

/**
 * Builds the URL for continuing a defense session with the next turn.
 *
 * @param sessionId - The session to continue.
 * @returns The continue URL.
 */
export function getContinueDefenseUrl(sessionId: string): string {
  // The append-turn endpoint for the session
  return buildApiUrl(`${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/turns`)
}

/**
 * Builds the URL for deleting a defense session.
 *
 * @param sessionId - The session to delete.
 * @returns The delete URL.
 */
export function getDeleteDefenseSessionUrl(sessionId: string): string {
  // The session's own endpoint
  return buildApiUrl(`${SESSIONS_PATH}/${encodeURIComponent(sessionId)}`)
}

/**
 * Builds the URL for rewinding a defense session to an earlier point.
 *
 * @param sessionId - The session to rewind.
 * @returns the rewind URL.
 */
export function getRewindDefenseUrl(sessionId: string): string {
  // The truncate-conversation endpoint for the session
  return buildApiUrl(`${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/rewind`)
}
