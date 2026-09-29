import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'
import type { ApiCaller } from '@/hooks/use-api'
import type { PagedList } from '@/lib/api/paged-list'
import type { ApiResult } from '@/types/api'

import type { AdminNote, AdminNoteFeedItem } from '../model/note-types'
import {
  getAdminNoteFeedUrl,
  getAdminNoteResolutionUrl,
  getAdminNoteUrl,
  getCreateAdminNoteUrl,
} from './note-api-urls'

/**
 * The backend for admin notes on defense conversations: authenticated calls to the .NET API, every one of them
 * behind the admin policy.
 */

/**
 * Writes a note about a conversation, optionally against one of its replies.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The conversation to write about.
 * @param turnId - The reply to write against, or null for the conversation as a whole.
 * @param content - The note as markdown/math source.
 * @param category - Which failure it names, or null to name none.
 * @returns The note as written.
 */
export function createAdminNote(
  apiCall: ApiCaller,
  sessionId: string,
  turnId: string | null,
  content: string,
  category: DefenseReportCategory | null
): Promise<ApiResult<AdminNote>> {
  return apiCall<AdminNote>(() => getCreateAdminNoteUrl(), {
    method: 'POST',
    body: JSON.stringify({ sessionId, turnId, content, category }),
  })
}

/**
 * Revises a note, replacing both what it says and which failure it names.
 *
 * @param apiCall - The authenticated API caller.
 * @param noteId - The note to revise.
 * @param content - What it should now say.
 * @param category - Which failure it should now name, or null to name none.
 * @returns The note as revised.
 */
export function updateAdminNote(
  apiCall: ApiCaller,
  noteId: string,
  content: string,
  category: DefenseReportCategory | null
): Promise<ApiResult<AdminNote>> {
  return apiCall<AdminNote>(() => getAdminNoteUrl(noteId), {
    method: 'PUT',
    body: JSON.stringify({ content, category }),
  })
}

/**
 * Drops a note.
 *
 * @param apiCall - The authenticated API caller.
 * @param noteId - The note to drop.
 * @returns Nothing on success.
 */
export function deleteAdminNote(apiCall: ApiCaller, noteId: string): Promise<ApiResult<void>> {
  return apiCall<void>(() => getAdminNoteUrl(noteId), { method: 'DELETE' })
}

/**
 * Marks a note settled, or puts it back to standing.
 *
 * @param apiCall - The authenticated API caller.
 * @param noteId - The note to mark.
 * @param resolved - True to settle it, false to put it back to standing.
 * @returns Nothing on success.
 */
export function setAdminNoteResolved(
  apiCall: ApiCaller,
  noteId: string,
  resolved: boolean
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getAdminNoteResolutionUrl(noteId), {
    method: resolved ? 'PUT' : 'DELETE',
  })
}

/**
 * Reads notes across every conversation, newest first.
 *
 * @param apiCall - The authenticated API caller.
 * @param openOnly - Whether to leave out the notes already settled.
 * @param pageNumber - 1-based page index to retrieve.
 * @returns The page of notes.
 */
export function fetchAdminNoteFeed(
  apiCall: ApiCaller,
  openOnly: boolean,
  pageNumber: number
): Promise<ApiResult<PagedList<AdminNoteFeedItem>>> {
  return apiCall<PagedList<AdminNoteFeedItem>>(() => getAdminNoteFeedUrl(openOnly, pageNumber))
}
