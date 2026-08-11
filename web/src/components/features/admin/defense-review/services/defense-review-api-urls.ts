import { buildApiUrl } from '@/components/shared/utils/url-utils'

/**
 * The base path for the defense-review endpoints.
 */
const REVIEW_PATH = '/admin/defense'

/**
 * The base path for the review notes endpoints.
 */
const NOTES_PATH = `${REVIEW_PATH}/notes`

/**
 * Builds the URL for reading a page of the review queue.
 *
 * @returns The queue URL.
 */
export function getDefenseReviewQueueUrl(): string {
  // The filter endpoint, which takes its many filters in a body rather than a query string
  return buildApiUrl(`${REVIEW_PATH}/sessions/filter`)
}

/**
 * Builds the URL for reading what the queue's filters can be set to.
 *
 * @returns The filter-options URL.
 */
export function getDefenseReviewFilterOptionsUrl(): string {
  // The options endpoint, which hands back all three lists at once
  return buildApiUrl(`${REVIEW_PATH}/filters`)
}

/**
 * Builds the URL for marking a whole set of conversations at once.
 *
 * @returns The bulk mark URL.
 */
export function getDefenseReviewBulkReadStateUrl(): string {
  // The set endpoint, which names its conversations in a body rather than in the path
  return buildApiUrl(`${REVIEW_PATH}/sessions/review`)
}

/**
 * Builds the URL for reading one conversation in full.
 *
 * @param sessionId - The conversation to read.
 * @returns The conversation's URL.
 */
export function getDefenseReviewDetailUrl(sessionId: string): string {
  // The conversation's own endpoint
  return buildApiUrl(`${REVIEW_PATH}/sessions/${encodeURIComponent(sessionId)}`)
}

/**
 * Builds the URL for a conversation's read stamp.
 *
 * @param sessionId - The conversation the stamp is about.
 * @returns The read stamp's URL.
 */
export function getDefenseReviewReadStateUrl(sessionId: string): string {
  // The conversation's own review endpoint, written to mark it read and dropped to mark it unread
  return buildApiUrl(`${REVIEW_PATH}/sessions/${encodeURIComponent(sessionId)}/review`)
}

/**
 * Builds the URL for where a reviewer picks a conversation up again.
 *
 * @param sessionId - The conversation the stamp is about.
 * @param turnId - The turn to leave unread, along with every turn after it.
 * @returns The URL for moving the stamp back to just before that turn.
 */
export function getDefenseReviewUnreadFromUrl(sessionId: string, turnId: string): string {
  // The conversation's own review endpoint, narrowed to the turn the reading picks up from
  const path = `${REVIEW_PATH}/sessions/${encodeURIComponent(sessionId)}/review/from`

  // Under the turn itself
  return buildApiUrl(`${path}/${encodeURIComponent(turnId)}`)
}

/**
 * Builds the URL for reading notes across every conversation.
 *
 * @param openOnly - Whether to leave out the notes already settled.
 * @param pageNumber - 1-based page index to retrieve.
 * @returns The feed URL.
 */
export function getAdminNoteFeedUrl(openOnly: boolean, pageNumber: number): string {
  // The feed endpoint, narrowed and paged
  return buildApiUrl(NOTES_PATH, {
    openOnly: String(openOnly),
    pageNumber: String(pageNumber),
  })
}

/**
 * Builds the URL for writing a note.
 *
 * @returns The create URL.
 */
export function getCreateAdminNoteUrl(): string {
  // The notes collection endpoint
  return buildApiUrl(NOTES_PATH)
}

/**
 * Builds the URL for one note.
 *
 * @param noteId - The note.
 * @returns The note's own URL.
 */
export function getAdminNoteUrl(noteId: string): string {
  // The note's own endpoint, written to revise it and dropped to delete it
  return buildApiUrl(`${NOTES_PATH}/${encodeURIComponent(noteId)}`)
}

/**
 * Builds the URL for whether a note is settled.
 *
 * @param noteId - The note.
 * @returns The resolution URL.
 */
export function getAdminNoteResolutionUrl(noteId: string): string {
  // The note's own resolution endpoint, written to settle it and dropped to put it back
  return buildApiUrl(`${NOTES_PATH}/${encodeURIComponent(noteId)}/resolution`)
}
