import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the defense sessions endpoints.
 */
const SESSIONS_PATH = '/defense/sessions'

/**
 * Builds the URL for listing a handout environment's defense sessions.
 *
 * @param target - The handout environment whose sessions to list.
 * @returns The list URL.
 */
export function getDefenseSessionsUrl(target: HandoutEnvironmentTarget): string {
  // The list endpoint, filtered to the environment
  return buildApiUrl(SESSIONS_PATH, {
    handoutContentId: target.handoutContentId,
    environmentId: target.environmentId,
  })
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

/**
 * Builds the URL for recording what the student holds against one examiner reply.
 *
 * @param sessionId - The session the reported reply was given in.
 * @param turnId - The reported reply.
 * @returns The report URL.
 */
export function getReportDefenseTurnUrl(sessionId: string, turnId: string): string {
  // The reply's own report endpoint
  return buildApiUrl(
    `${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}/report`
  )
}

/**
 * Builds the URL for recording what a student says about a defense conversation.
 *
 * @param sessionId - The session being answered for.
 * @returns The feedback URL.
 */
export function getDefenseFeedbackUrl(sessionId: string): string {
  // The session's own feedback endpoint
  return buildApiUrl(`${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/feedback`)
}
