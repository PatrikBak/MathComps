import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * Builds the URL for listing a problem's defense sessions.
 *
 * @param problemKey - The stable key of the problem whose sessions to list.
 * @returns The list URL.
 */
export function getDefenseSessionsUrl(problemKey: string): string {
  // The list endpoint, filtered to the problem
  return buildApiUrl(`/defense/sessions?problemKey=${encodeURIComponent(problemKey)}`)
}

/**
 * Builds the URL for opening a new defense session.
 *
 * @returns The start URL.
 */
export function getStartDefenseUrl(): string {
  // The create endpoint
  return buildApiUrl('/defense/sessions')
}

/**
 * Builds the URL for continuing a defense session with the next turn.
 *
 * @param sessionId - The session to continue.
 * @returns The continue URL.
 */
export function getContinueDefenseUrl(sessionId: string): string {
  // The append-turn endpoint for the session
  return buildApiUrl(`/defense/sessions/${sessionId}/turns`)
}

/**
 * Builds the URL for deleting a defense session.
 *
 * @param sessionId - The session to delete.
 * @returns The delete URL.
 */
export function getDeleteDefenseSessionUrl(sessionId: string): string {
  // The session's own endpoint
  return buildApiUrl(`/defense/sessions/${sessionId}`)
}
