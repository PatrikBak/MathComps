import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { ADMIN_DEFENSE_QUERY_KEY } from '../../conversation/hooks/conversation-cache'

/** The prefix every narrowing of the notes feed hangs off, so one call can match them all. */
const FEED_QUERY_KEY = [...ADMIN_DEFENSE_QUERY_KEY, 'feed'] as const

/**
 * Builds the query key for one narrowing of the notes feed, whose pages accumulate under it.
 *
 * @param openOnly - Whether the feed is leaving out what has been settled.
 * @param locale - The language it is read in.
 * @returns The query key.
 */
export function noteFeedQueryKey(openOnly: boolean, locale: string): QueryKey {
  // The narrowing rides in the key, so each one accumulates its own pages
  return [...FEED_QUERY_KEY, openOnly, locale] as const
}

/**
 * Refreshes the cross-conversation notes feed. It reads newest-first across every conversation, so a write can't
 * be patched into place and has to be read back.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateNoteFeed(queryClient: QueryClient): void {
  // Every page of the feed, whichever narrowing it is under
  void queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY })
}
