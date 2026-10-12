import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type { ReviewNote } from '../model/note-types'
import {
  getCreateReviewNoteUrl,
  getReviewNoteResolutionUrl,
  getReviewNoteUrl,
} from './note-api-urls'

/**
 * The backend for review notes on defense conversations: authenticated calls to the .NET API, open to admins on
 * every conversation and to the problem selection's reviewers on the conversations held about the proposals.
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
export function createReviewNote(
  apiCall: ApiCaller,
  sessionId: string,
  turnId: string | null,
  content: string,
  category: DefenseReportCategory | null
): Promise<ApiResult<ReviewNote>> {
  return apiCall<ReviewNote>(() => getCreateReviewNoteUrl(), {
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
export function updateReviewNote(
  apiCall: ApiCaller,
  noteId: string,
  content: string,
  category: DefenseReportCategory | null
): Promise<ApiResult<ReviewNote>> {
  return apiCall<ReviewNote>(() => getReviewNoteUrl(noteId), {
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
export function deleteReviewNote(apiCall: ApiCaller, noteId: string): Promise<ApiResult<void>> {
  return apiCall<void>(() => getReviewNoteUrl(noteId), { method: 'DELETE' })
}

/**
 * Marks a note settled, or puts it back to standing.
 *
 * @param apiCall - The authenticated API caller.
 * @param noteId - The note to mark.
 * @param resolved - True to settle it, false to put it back to standing.
 * @returns Nothing on success.
 */
export function setReviewNoteResolved(
  apiCall: ApiCaller,
  noteId: string,
  resolved: boolean
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getReviewNoteResolutionUrl(noteId), {
    method: resolved ? 'PUT' : 'DELETE',
  })
}
