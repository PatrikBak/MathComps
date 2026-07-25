import type { QueryClient, QueryKey } from '@tanstack/react-query'

/** The root every defense query key hangs off, so one call can match them all. */
const DEFENSE_QUERY_KEY = ['defense'] as const

/**
 * Builds the query key for a user's cross-problem list of defenses.
 *
 * @param userId - The signed-in user's id, or null while it isn't known.
 *
 * @returns The query key.
 */
export function myDefensesQueryKey(userId: string | null): QueryKey {
  // Keyed by user, so a switched account never reads the previous one's list
  return [...DEFENSE_QUERY_KEY, 'mine', userId] as const
}

/**
 * Builds the query key for the sessions a user holds about one problem.
 *
 * @param problemKey - The stable key of the problem whose sessions these are.
 * @param userId - The signed-in user's id, or null while it isn't known.
 *
 * @returns The query key.
 */
export function defenseSessionsQueryKey(problemKey: string, userId: string | null): QueryKey {
  // One key per user and problem
  return [...DEFENSE_QUERY_KEY, 'sessions', problemKey, userId] as const
}

/**
 * Refreshes every cached view of a user's defenses. The same sessions are listed twice, per problem and across all
 * of them, so a write through either one has to reach both or the untouched view keeps showing a session that is
 * gone.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateDefenseLists(queryClient: QueryClient): void {
  // Every defense list, whichever problem or user it belongs to
  void queryClient.invalidateQueries({ queryKey: DEFENSE_QUERY_KEY })
}
