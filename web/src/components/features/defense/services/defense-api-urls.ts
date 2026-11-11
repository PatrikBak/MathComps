import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the defense sessions endpoints.
 */
const SESSIONS_PATH = '/defense/sessions'

/**
 * The base path for the endpoints reading the photos students take of their handwritten work.
 */
const PHOTOS_PATH = '/defense/photos'

/**
 * The base path for the endpoints handing photos taken on a phone over to a composer open elsewhere.
 */
const PHOTO_HANDOFF_PATH = `${PHOTOS_PATH}/handoff`

/**
 * Builds the URL for reading the examiner's canned lines.
 *
 * @returns The copy URL.
 */
export function getDefenseCopyUrl(): string {
  // The copy endpoint, which needs no account
  return buildApiUrl('/defense/copy')
}

/**
 * Builds the URL for listing the user's own defense sessions against a handout environment.
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
 * Builds the URL for listing the user's own defense sessions against an archive problem.
 *
 * @param problemId - The archive problem whose sessions to list.
 * @returns The list URL.
 */
export function getProblemDefenseSessionsUrl(problemId: string): string {
  // The list endpoint for one archive problem
  return buildApiUrl(`${SESSIONS_PATH}/problems/${encodeURIComponent(problemId)}`)
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
 * @returns The rewind URL.
 */
export function getRewindDefenseUrl(sessionId: string): string {
  // The truncate-conversation endpoint for the session
  return buildApiUrl(`${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/rewind`)
}

/**
 * Builds the URL for one examiner reply's report.
 *
 * @param sessionId - The session the reply was given in.
 * @param turnId - The reply the report is about.
 * @returns The report URL.
 */
export function getReportDefenseTurnUrl(sessionId: string, turnId: string): string {
  // The reply's own report endpoint
  return buildApiUrl(
    `${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}/report`
  )
}

/**
 * Builds the URL for a defense conversation's feedback.
 *
 * @param sessionId - The session the feedback is about.
 * @returns The feedback URL.
 */
export function getDefenseFeedbackUrl(sessionId: string): string {
  // The session's own feedback endpoint
  return buildApiUrl(`${SESSIONS_PATH}/${encodeURIComponent(sessionId)}/feedback`)
}

/**
 * Builds the URL for reading a photo for a defense of a handout environment.
 *
 * @param target - The handout environment being defended.
 * @returns The read URL.
 */
export function getReadHandoutPhotoUrl(target: HandoutEnvironmentTarget): string {
  // The read endpoint, told which environment the photo is for
  return buildApiUrl(PHOTOS_PATH, {
    handoutContentId: target.handoutContentId,
    environmentId: target.environmentId,
  })
}

/**
 * Builds the URL for reading a photo for a defense of an archive problem.
 *
 * @param problemId - The archive problem being defended.
 * @returns The read URL.
 */
export function getReadProblemPhotoUrl(problemId: string): string {
  // The read endpoint for one archive problem
  return buildApiUrl(`${PHOTOS_PATH}/problems/${encodeURIComponent(problemId)}`)
}

/**
 * Builds the URL of a handoff code: pointing the student's code at what they are defending, or reading where a code
 * sends photos now.
 *
 * @returns The handoff URL.
 */
export function getPhotoHandoffUrl(): string {
  // The handoff endpoint
  return buildApiUrl(PHOTO_HANDOFF_PATH)
}

/**
 * Builds the URL for sending a photo through a handoff code.
 *
 * @param capturedAt - When the photo was taken.
 * @returns The send URL.
 */
export function getHandoffPhotosUrl(capturedAt: Date): string {
  // The photos endpoint, told when this photo was taken
  return buildApiUrl(`${PHOTO_HANDOFF_PATH}/photos`, { capturedAt: capturedAt.toISOString() })
}
