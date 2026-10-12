import { buildApiUrl } from '@/components/shared/utils/url-utils'

import { CONVERSATION_REVIEW_PATH } from './conversation-api-urls'

/**
 * The base path for the review notes endpoints.
 */
const NOTES_PATH = `${CONVERSATION_REVIEW_PATH}/notes`

/**
 * Builds the URL for writing a note.
 *
 * @returns The create URL.
 */
export function getCreateReviewNoteUrl(): string {
  // The notes collection endpoint
  return buildApiUrl(NOTES_PATH)
}

/**
 * Builds the URL for one note.
 *
 * @param noteId - The note.
 * @returns The note's own URL.
 */
export function getReviewNoteUrl(noteId: string): string {
  // The note's own endpoint, written to revise it and dropped to delete it
  return buildApiUrl(`${NOTES_PATH}/${encodeURIComponent(noteId)}`)
}

/**
 * Builds the URL for whether a note is settled.
 *
 * @param noteId - The note.
 * @returns The resolution URL.
 */
export function getReviewNoteResolutionUrl(noteId: string): string {
  // The note's own resolution endpoint, written to settle it and dropped to put it back
  return buildApiUrl(`${NOTES_PATH}/${encodeURIComponent(noteId)}/resolution`)
}
