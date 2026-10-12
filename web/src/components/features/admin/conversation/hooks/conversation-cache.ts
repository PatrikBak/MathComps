import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'

import { defenseTargetKey } from '@/components/features/defense/model/defense-target'
import type { DefenseSessionTarget } from '@/components/features/defense/model/defense-types'
import type { PagedList } from '@/lib/api/paged-list'

import type { DefenseReviewConversation } from '../../defense-review/model/defense-review-types'

/** The root every admin query about defense conversations hangs off. */
export const ADMIN_DEFENSE_QUERY_KEY = ['adminDefense'] as const

/** The prefix the review queue's pages hang off, so one call can match every one of them. */
export const QUEUE_QUERY_KEY = [...ADMIN_DEFENSE_QUERY_KEY, 'queue'] as const

/**
 * Builds the query key for one student's conversations about one problem.
 *
 * The problem is keyed by the ids naming it and nothing else, so a target carrying its display names reaches the
 * same entry as one carrying only the ids.
 *
 * @param userId - The student.
 * @param target - The problem.
 * @returns The query key.
 */
export function studentConversationsQueryKey(
  userId: string,
  target: DefenseSessionTarget
): QueryKey {
  // The student's own conversations, narrowed to the problem by the ids naming it
  return [...ADMIN_DEFENSE_QUERY_KEY, 'student', userId, defenseTargetKey(target)] as const
}

/**
 * Rewrites one conversation wherever a cached page of the review queue holds it, under every filtering at once.
 *
 * Patched rather than read back on purpose: refetching would reorder the rows under an open conversation and
 * change which one stepping forward lands on. The cost is that a row which no longer matches an active filter
 * stays visible until something else refreshes the queue.
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
 * Rewrites a whole set of conversations wherever cached pages of the review queue hold them, in one sweep.
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
