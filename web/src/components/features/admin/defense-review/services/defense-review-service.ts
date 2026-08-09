import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'
import type { ApiCaller } from '@/hooks/use-api'
import type { PagedList } from '@/lib/api/paged-list'
import type { ApiResult } from '@/types/api'

import type {
  AdminNote,
  AdminNoteFeedItem,
  DefenseReviewConversation,
  DefenseReviewDetail,
  DefenseReviewFilter,
  DefenseReviewFilterOptions,
} from '../model/defense-review-types'
import {
  getAdminNoteFeedUrl,
  getAdminNoteResolutionUrl,
  getAdminNoteUrl,
  getCreateAdminNoteUrl,
  getDefenseReviewBulkReadStateUrl,
  getDefenseReviewDetailUrl,
  getDefenseReviewFilterOptionsUrl,
  getDefenseReviewQueueUrl,
  getDefenseReviewReadStateUrl,
} from './defense-review-api-urls'

/**
 * The backend for reviewing defense conversations: authenticated calls to the .NET API, every one of them
 * behind the admin policy. Each function takes an {@link ApiCaller} and returns an {@link ApiResult}; the
 * consumer unwraps it.
 */

/**
 * Reads one page of the review queue, the conversations spoken to most recently first.
 *
 * @param apiCall - The authenticated API caller.
 * @param filter - Which conversations to show.
 * @param pageNumber - 1-based page index to retrieve.
 * @param signal - Aborts the request when the query is dropped.
 * @returns The page of conversations.
 */
export function fetchDefenseReviewQueue(
  apiCall: ApiCaller,
  filter: DefenseReviewFilter,
  pageNumber: number,
  signal: AbortSignal
): Promise<ApiResult<PagedList<DefenseReviewConversation>>> {
  return apiCall<PagedList<DefenseReviewConversation>>(() => getDefenseReviewQueueUrl(), {
    method: 'POST',
    body: JSON.stringify({ filter, pageNumber }),
    signal,
  })
}

/**
 * Reads what the queue's filters can be set to.
 *
 * @param apiCall - The authenticated API caller.
 * @returns Every student, problem, and set of examiner settings a conversation exists under.
 */
export function fetchDefenseReviewFilterOptions(
  apiCall: ApiCaller
): Promise<ApiResult<DefenseReviewFilterOptions>> {
  return apiCall<DefenseReviewFilterOptions>(() => getDefenseReviewFilterOptionsUrl())
}

/**
 * Reads one conversation in full, along with the read stamp as it stood before this read.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The conversation to read.
 * @param signal - Aborts the request when the read is dropped.
 * @returns The whole conversation.
 */
export function fetchDefenseReviewDetail(
  apiCall: ApiCaller,
  sessionId: string,
  signal: AbortSignal
): Promise<ApiResult<DefenseReviewDetail>> {
  return apiCall<DefenseReviewDetail>(() => getDefenseReviewDetailUrl(sessionId), { signal })
}

/**
 * Records that a conversation has been read as of now, or takes that record back.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The conversation.
 * @param read - True to stamp it as read, false to leave it unread.
 * @returns Nothing on success.
 */
export function setDefenseReviewReadState(
  apiCall: ApiCaller,
  sessionId: string,
  read: boolean
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getDefenseReviewReadStateUrl(sessionId), {
    method: read ? 'PUT' : 'DELETE',
  })
}

/**
 * Marks a whole set of conversations read, or takes this reviewer's stamps back off the lot of them.
 *
 * One request rather than one per conversation: the endpoints behind this surface are rate limited per caller,
 * and a queue scrolled through a backlog holds more conversations than one limiter window allows.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionIds - The conversations to mark.
 * @param read - True to stamp them as read, false to leave them unread.
 * @returns Nothing on success.
 */
export function setDefenseReviewReadStates(
  apiCall: ApiCaller,
  sessionIds: readonly string[],
  read: boolean
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getDefenseReviewBulkReadStateUrl(), {
    method: 'PUT',
    body: JSON.stringify({ sessionIds, read }),
  })
}

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
 * @param signal - Aborts the request when the query is dropped.
 * @returns The page of notes.
 */
export function fetchAdminNoteFeed(
  apiCall: ApiCaller,
  openOnly: boolean,
  pageNumber: number,
  signal: AbortSignal
): Promise<ApiResult<PagedList<AdminNoteFeedItem>>> {
  return apiCall<PagedList<AdminNoteFeedItem>>(() => getAdminNoteFeedUrl(openOnly, pageNumber), {
    signal,
  })
}
