import type { ApiCaller } from '@/hooks/use-api'
import type { PagedList } from '@/lib/api/paged-list'
import type { ApiResult } from '@/types/api'

import type { AdminNoteFeedItem } from '../model/note-types'
import { getAdminNoteFeedUrl } from './note-api-urls'

/**
 * The backend for the notes feed: an authenticated call to the .NET API, open to admins alone.
 */

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
