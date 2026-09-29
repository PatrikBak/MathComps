import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { QUEUE_QUERY_KEY } from '../../conversation/hooks/conversation-cache'
import { serializeFilter } from '../model/defense-review-filters'
import type { DefenseReviewFilter } from '../model/defense-review-types'

/** How a key spells a filtering that only holds what hasn't been read yet. */
const UNREAD_FILTER_PART = serializeFilter({ unread: true })

/**
 * What one filtering of the queue names, beyond the prefix it shares with every other filtering.
 *
 * These ride in a single object so a filtering sitting in the cache can be read back by name. Read off a
 * position, a reader has to know which slot it was written at, which nothing checks.
 */
type QueueKeySegment = {
  /** The language the pages were read in, which names each conversation's problem. */
  locale: string
  /** The filtering they were read under. */
  filter: string
}

/**
 * Builds the query key for one filtering of the review queue.
 *
 * @param filter - Which conversations the queue is showing.
 * @param locale - The language it is read in.
 * @returns The query key.
 */
export function reviewQueueQueryKey(filter: DefenseReviewFilter, locale: string): QueryKey {
  // Keyed by the serialized filter, since the object's fields carry whatever order they were built up in and
  // would otherwise key one filtering as two
  return [...QUEUE_QUERY_KEY, { locale, filter: serializeFilter(filter) }] as const
}

/**
 * Reads the filtering a queue's pages were read under off the key they are cached under.
 *
 * Only {@link reviewQueueQueryKey} builds a key shaped like this, and only the queue's own pages ever reach
 * here: React Query matches the key a caller asked under before it runs their own predicate, so a query of
 * another kind is turned away first.
 *
 * @param queryKey - The key a filtering's pages are held under.
 * @returns What it narrows to, serialized.
 */
function queueFilterOf(queryKey: readonly unknown[]): string {
  // The segment naming this filtering, which every queue key ends with
  const segment = queryKey[queryKey.length - 1] as QueueKeySegment

  // What it narrows to
  return segment.filter
}

/**
 * Refreshes every cached filtering of the queue that only holds unread conversations.
 *
 * Rewriting a row in place cannot take it off a page it no longer belongs on, so a queue narrowed to the unread
 * goes on offering conversations that have just been marked read, and counting them. Those filterings are the only
 * ones a read mark can falsify, which is why the rest are left alone: they are already right, and reading one back
 * would cost the reader the pages loaded under it.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateUnreadQueue(queryClient: QueryClient): void {
  // Every filtering whose key carries the unread field, whatever else it narrows by
  void queryClient.invalidateQueries({
    queryKey: QUEUE_QUERY_KEY,
    predicate: (query) =>
      // Matched between the separators rather than anywhere in the string, so no other field can stand in for it
      queueFilterOf(query.queryKey).split('&').includes(UNREAD_FILTER_PART),
  })
}
