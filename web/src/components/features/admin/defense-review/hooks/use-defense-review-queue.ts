import { useLocale } from 'next-intl'
import { useCallback, useMemo } from 'react'

import type { ApiCaller } from '@/hooks/use-api'
import { usePagedQuery } from '@/hooks/use-paged-query'
import { dedupePagedItems } from '@/lib/api/paged-list'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { DefenseReviewConversation, DefenseReviewFilter } from '../model/defense-review-types'
import { fetchDefenseReviewQueue } from '../services/defense-review-service'
import { reviewQueueQueryKey } from './defense-review-cache'

/**
 * What {@link useDefenseReviewQueue} hands back.
 */
type UseDefenseReviewQueueResult = {
  /** The conversations loaded so far, most recently active first. */
  conversations: DefenseReviewConversation[]
  /** Every loaded conversation's id in the order the queue shows them. */
  orderedConversationIds: string[]
  /** How many conversations the filters match in all. */
  totalConversations: number
  /** Whether more conversations remain to load. */
  hasMore: boolean
  /** Whether another page is on its way. */
  isLoadingMore: boolean
  /** The state of the fetch. */
  uiState: QueryUiState
  /** Loads the next page of conversations. */
  loadMore: () => void
  /** Runs the query again after it failed. */
  retry: () => void
}

/**
 * Reads the review queue one page at a time, keeping every page loaded so far.
 *
 * @param filter - Which conversations to show.
 * @returns The queue as described by {@link UseDefenseReviewQueueResult}.
 */
export function useDefenseReviewQueue(filter: DefenseReviewFilter): UseDefenseReviewQueueResult {
  // The language the queue is read in
  const locale = useLocale()

  // Fetches one page
  const fetchPage = useCallback(
    (apiCall: ApiCaller, pageNumber: number) =>
      fetchDefenseReviewQueue(apiCall, filter, pageNumber),
    [filter]
  )

  // The queue itself, a page of conversations at a time
  const paged = usePagedQuery({
    queryKey: reviewQueueQueryKey(filter, locale),
    fetchPage,
    // The queue is an admin's own read, so it is made as them
    requireAuth: true,
    cachePolicy: cachePolicy.userData,
  })

  // The pages loaded so far, which stay put across renders where the result object doesn't
  const { pages } = paged

  // Every loaded page flattened into one list
  const conversations = useMemo(
    () => dedupePagedItems(pages, (conversation) => conversation.id),
    [pages]
  )

  // Every conversation's id in the order the queue shows them
  const orderedConversationIds = useMemo(
    () => conversations.map((conversation) => conversation.id),
    [conversations]
  )

  // The queue as it currently stands, and the ways on from it
  return {
    conversations,
    orderedConversationIds,
    totalConversations: paged.totalCount,
    hasMore: paged.hasMore,
    isLoadingMore: paged.isLoadingMore,
    uiState: paged.uiState,
    loadMore: paged.loadMore,
    retry: paged.retry,
  }
}
