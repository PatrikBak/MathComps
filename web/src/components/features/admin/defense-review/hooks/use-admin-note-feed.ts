import { useLocale } from 'next-intl'
import { useCallback, useMemo, useState } from 'react'

import { readyApiCall, useApi } from '@/hooks/use-api'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { unwrap } from '@/lib/api/api-error'
import { dedupePagedItems } from '@/lib/api/paged-list'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { AdminNoteFeedItem } from '../model/defense-review-types'
import { fetchAdminNoteFeed } from '../services/defense-review-service'
import { noteFeedQueryKey } from './defense-review-cache'

/**
 * What {@link useAdminNoteFeed} hands back.
 */
type UseAdminNoteFeedResult = {
  /** Every note loaded so far, newest first. */
  items: AdminNoteFeedItem[]
  /** How many notes the narrowing leaves in all. */
  totalCount: number
  /** Whether more pages remain. */
  hasMore: boolean
  /** Whether another page is on its way. */
  isLoadingMore: boolean
  /** Whether the last attempt gave up. */
  hasFailed: boolean
  /** Whether what is settled is being left out. */
  openOnly: boolean
  /** Leaves out what is settled, or puts it back. */
  setOpenOnly: (openOnly: boolean) => void
  /** Loads the next page, keeping the ones already read. */
  loadMore: () => void
  /** The state of the fetch. */
  uiState: QueryUiState
}

/**
 * Reads notes across every conversation, which is what makes what has been concluded readable without opening
 * the conversations it was concluded in.
 *
 * Pages accumulate rather than replace: the feed is scanned back through, and swapping a page out from under a
 * reader who asked for more would take away the ones they were reading.
 *
 * @param enabled - Whether the feed is on screen and so worth reading.
 * @returns The feed as described by {@link UseAdminNoteFeedResult}.
 */
export function useAdminNoteFeed(enabled: boolean): UseAdminNoteFeedResult {
  // The authenticated caller
  const api = useApi({ requireAuth: true })

  // The language the feed is read in
  const locale = useLocale()

  // Whether what is settled is being left out
  const [openOnly, setOpenOnly] = useState(false)

  // Fetches one page of notes
  const fetchPage = useCallback(
    async (pageNumber: number, signal: AbortSignal) =>
      unwrap(await fetchAdminNoteFeed(readyApiCall(api), openOnly, pageNumber, signal)),
    [api, openOnly]
  )

  // The feed itself, a page of notes at a time
  const paged = usePagedQuery({
    queryKey: noteFeedQueryKey(openOnly, locale),
    fetchPage,
    enabled: enabled && api.state === 'ready',
    cachePolicy: cachePolicy.userData,
  })

  // The pages read so far, which stay put across renders where the result object doesn't
  const { pages } = paged

  // Every loaded page flattened into one list
  const items = useMemo(() => dedupePagedItems(pages, (item) => item.note.id), [pages])

  // The notes read so far, and the ways to read further
  return {
    items,
    totalCount: paged.totalCount,
    hasMore: paged.hasMore,
    isLoadingMore: paged.isLoadingMore,
    hasFailed: paged.hasFailed,
    openOnly,
    setOpenOnly,
    loadMore: paged.loadMore,
    uiState: paged.uiState,
  }
}
