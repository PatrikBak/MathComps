import { buildApiUrl } from '@/components/shared/utils/url-utils'

import { ADMIN_DEFENSE_PATH } from '../../conversation/services/conversation-api-urls'

/**
 * The base path for the admin notes endpoints.
 */
const NOTES_PATH = `${ADMIN_DEFENSE_PATH}/notes`

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
