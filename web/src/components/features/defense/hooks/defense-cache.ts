import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseTarget } from '../model/defense-target'
import type { DefenseSession, DefenseSessionList } from '../model/defense-types'

/** The root every defense query key hangs off, so one call can match them all. */
const DEFENSE_QUERY_KEY = ['defense'] as const

/**
 * Builds the query key for the examiner's canned lines.
 *
 * Kept out of {@link DEFENSE_QUERY_KEY} so writing a session never refetches copy that no write can
 * change. The locale belongs in the key because the request asks for it in a header, which React Query
 * cannot see.
 *
 * @param locale - The language the lines are read in.
 *
 * @returns The query key.
 */
export function defenseCopyQueryKey(locale: string): QueryKey {
  // One entry per language
  return ['defense-copy', locale] as const
}

/**
 * Builds the query key for a user's cross-problem list of defenses.
 *
 * The language belongs in it because the list names each conversation's competition, which is worded.
 *
 * @param userId - The signed-in user's id, or null while it isn't known.
 * @param locale - The language the list is read in.
 *
 * @returns The query key.
 */
export function myDefensesQueryKey(userId: string | null, locale: string): QueryKey {
  // Keyed by user, so a switched account never reads the previous one's list
  return [...DEFENSE_QUERY_KEY, 'mine', userId, locale] as const
}

/**
 * The key every conversation list about one competition problem hangs off.
 *
 * The full key below adds the user, and {@link forgetCompetitionDefenseLists} matches on this much alone, so
 * both of them follow whatever this says.
 *
 * @param problemId - Which problem the conversations are about.
 *
 * @returns The key.
 */
function problemSessionsKeyPrefix(problemId: string): QueryKey {
  // The problem, under the sessions root every defense list hangs off
  return [...DEFENSE_QUERY_KEY, 'sessions', 'competition', problemId] as const
}

/**
 * Builds the query key for the sessions a user holds against one problem.
 *
 * Every arm keeps 'sessions' as its second segment, so {@link patchCachedDefenseSession} still reaches
 * all of them with one prefix.
 *
 * @param target - What the sessions are held against.
 * @param userId - The signed-in user's id, or null while it isn't known.
 *
 * @returns The query key.
 */
export function defenseSessionsQueryKey(target: DefenseTarget, userId: string | null): QueryKey {
  switch (target.kind) {
    // One key per user and handout environment
    case 'handout':
      return [
        ...DEFENSE_QUERY_KEY,
        'sessions',
        'handout',
        target.environment.handoutContentId,
        target.environment.environmentId,
        userId,
      ] as const

    // One key per user and competition problem
    case 'competition':
      return [...problemSessionsKeyPrefix(target.problemId), userId] as const

    // Every target is handled above
    default:
      return assertNever(target)
  }
}

/**
 * Forgets every cached list of the conversations held about the given problems.
 *
 * Their key names the problem, and the problem outlives the entry: a competition taken a second time
 * opens holding the previous run's conversations, offering them to be read and resumed under the fresh
 * clock, until the read behind them lands.
 *
 * @param queryClient - The cache to forget them from.
 * @param problemIds - The problems whose lists to forget.
 */
export function forgetCompetitionDefenseLists(
  queryClient: QueryClient,
  problemIds: string[]
): void {
  // Each problem's lists, whichever user they belong to
  for (const problemId of problemIds) {
    queryClient.removeQueries({ queryKey: problemSessionsKeyPrefix(problemId) })
  }
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

/**
 * Rewrites one session wherever a cached list of a problem's defenses holds it. What a student says about a
 * conversation is already on their screen, so the lists only have to agree with it rather than read every
 * transcript back to find out what it now says.
 *
 * @param queryClient - The cache to rewrite.
 * @param sessionId - The session whose entry changed.
 * @param rewrite - Produces the session as it now stands.
 */
export function patchCachedDefenseSession(
  queryClient: QueryClient,
  sessionId: string,
  rewrite: (session: DefenseSession) => DefenseSession
): void {
  // Only the per-problem lists: the cross-problem one carries none of what a student says, so there is
  // nothing in it to keep in step
  queryClient.setQueriesData<DefenseSessionList>(
    { queryKey: [...DEFENSE_QUERY_KEY, 'sessions'] },
    (list) =>
      list && {
        ...list,
        sessions: list.sessions.map((session) =>
          session.id === sessionId ? rewrite(session) : session
        ),
      }
  )
}
