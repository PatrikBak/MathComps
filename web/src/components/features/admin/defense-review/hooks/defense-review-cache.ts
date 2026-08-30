import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'

import type { PagedList } from '@/lib/api/paged-list'

import { serializeFilter } from '../model/defense-review-filters'
import type { DefenseReviewConversation, DefenseReviewFilter } from '../model/defense-review-types'

/** The root every review query key hangs off, so one call can match them all. */
const REVIEW_QUERY_KEY = ['adminDefenseReview'] as const

/** The prefix the queue's pages hang off, so one call can match every one of them. */
const QUEUE_QUERY_KEY = [...REVIEW_QUERY_KEY, 'queue'] as const

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
 * Builds the query key for what the queue's filters can be set to.
 *
 * @param locale - The language the options are named in.
 * @returns The query key.
 */
export function reviewFilterOptionsQueryKey(locale: string): QueryKey {
  // One list per language for the whole surface, since the options are counted over every conversation
  return [...REVIEW_QUERY_KEY, 'filters', locale] as const
}

/**
 * The key every reading of one conversation hangs off.
 *
 * {@link reviewDetailQueryKey} adds the language, and {@link invalidateReviewDetail} matches on this much
 * alone, so both of them follow whatever this says.
 *
 * @param sessionId - The conversation.
 * @returns The key.
 */
function reviewDetailKeyPrefix(sessionId: string): QueryKey {
  // Kept apart from the note keys, so writing a note doesn't drag a whole transcript back over the wire
  return [...REVIEW_QUERY_KEY, 'detail', sessionId] as const
}

/**
 * Builds the query key for one conversation read in full.
 *
 * @param sessionId - The conversation.
 * @param locale - The language it is read in.
 * @returns The query key.
 */
export function reviewDetailQueryKey(sessionId: string, locale: string): QueryKey {
  // The language last, so the prefix still reaches the conversation in every language it was read in
  return [...reviewDetailKeyPrefix(sessionId), locale] as const
}

/**
 * Refreshes one conversation wherever it is cached, in every language it has been read in. What a note says
 * about a conversation is true of the conversation rather than of the reading, so a copy left holding the note
 * list from before the write would go on offering a settled note as still standing.
 *
 * @param queryClient - The cache to refresh.
 * @param sessionId - The conversation whose notes changed.
 */
export function invalidateReviewDetail(queryClient: QueryClient, sessionId: string): void {
  // That one conversation, whichever language it was read in
  void queryClient.invalidateQueries({ queryKey: reviewDetailKeyPrefix(sessionId) })
}

/**
 * Builds the query key for one narrowing of the notes feed, whose pages accumulate under it.
 *
 * @param openOnly - Whether the feed is leaving out what has been settled.
 * @param locale - The language it is read in.
 * @returns The query key.
 */
export function noteFeedQueryKey(openOnly: boolean, locale: string): QueryKey {
  // The narrowing rides in the key, so each one accumulates its own pages
  return [...REVIEW_QUERY_KEY, 'feed', openOnly, locale] as const
}

/**
 * Refreshes the cross-conversation notes feed. It reads newest-first across every conversation, so a write can't
 * be patched into place the way a row can and has to be read back.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateNoteFeed(queryClient: QueryClient): void {
  // Every page of the feed, whichever narrowing it is under
  void queryClient.invalidateQueries({ queryKey: [...REVIEW_QUERY_KEY, 'feed'] })
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

/**
 * Rewrites one conversation wherever a cached page of the queue holds it, under every filtering at once.
 *
 * Patched rather than read back on purpose: refetching would reorder the rows under an open conversation and
 * change which one stepping forward lands on. The cost is that a row which no longer matches an active filter
 * stays visible until something else refreshes the queue, which is the right way round while the reader is
 * looking straight at it.
 *
 * @param queryClient - The cache to rewrite.
 * @param sessionId - The conversation whose row changed.
 * @param rewrite - Produces the row as it now stands.
 */
export function patchCachedQueueConversation(
  queryClient: QueryClient,
  sessionId: string,
  rewrite: (conversation: DefenseReviewConversation) => DefenseReviewConversation
): void {
  // The one conversation, through the same sweep a set goes through
  patchCachedQueueConversations(queryClient, [sessionId], rewrite)
}

/**
 * Rewrites a whole set of conversations wherever cached pages of the queue hold them, in one sweep.
 *
 * Carries the same tradeoff as {@link patchCachedQueueConversation}: a row is patched, never read back.
 *
 * One sweep rather than one per conversation: a sweep walks every page under every filtering, so a backlog
 * cleared one conversation at a time rebuilds the whole cache once per conversation in it.
 *
 * @param queryClient - The cache to rewrite.
 * @param sessionIds - The conversations whose rows changed.
 * @param rewrite - Produces a row as it now stands.
 */
export function patchCachedQueueConversations(
  queryClient: QueryClient,
  sessionIds: readonly string[],
  rewrite: (conversation: DefenseReviewConversation) => DefenseReviewConversation
): void {
  // Which rows the sweep is looking for
  const wanted = new Set(sessionIds)

  // Every cached page under every filtering
  queryClient.setQueriesData<InfiniteData<PagedList<DefenseReviewConversation>>>(
    { queryKey: QUEUE_QUERY_KEY },
    (cached) => {
      // Nothing cached under this filtering yet
      if (!cached) return cached

      // Walk every page and every conversation on it
      return {
        ...cached,
        pages: cached.pages.map((page) => ({
          ...page,
          items: page.items.map((conversation) =>
            wanted.has(conversation.id) ? rewrite(conversation) : conversation
          ),
        })),
      }
    }
  )
}
