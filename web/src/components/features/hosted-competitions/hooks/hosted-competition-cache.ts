import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type {
  HostedCompetitionEntry,
  HostedCompetitionProblem,
  HostedCompetitionsView,
} from '../model/hosted-competition-types'

/** Root of every query key the competitions surface reads under, so invalidating it reaches them all. */
export const HOSTED_COMPETITIONS_QUERY_KEY = ['competitions'] as const

/**
 * Who a cached competitions answer belongs to.
 *
 * Every answer on this surface is somebody's: which entries are on it, what they still owe, what each row
 * offers. Cached under anything less, signing out and back in as somebody else hands the second reader the
 * first one's history.
 *
 * A mocked student's identity is the scenario that invented them, and an anonymous reader has none.
 */
export type HostedCompetitionsReaderKey = string | null

/**
 * The key the competitions view is cached under.
 *
 * @param readerKey - Who the answer is about.
 *
 * @returns The cache key.
 */
export function hostedCompetitionsViewQueryKey(readerKey: HostedCompetitionsReaderKey): QueryKey {
  // The view, per reader. Nothing in it is worded, so two languages read one answer
  return [...HOSTED_COMPETITIONS_QUERY_KEY, 'view', readerKey] as const
}

/**
 * The key the student's entry readiness is cached under.
 *
 * @param readerKey - Who the answer is about.
 *
 * @returns The cache key.
 */
export function entryReadinessQueryKey(readerKey: HostedCompetitionsReaderKey): QueryKey {
  // Readiness is about the student rather than the reading, so it carries no language
  return [...HOSTED_COMPETITIONS_QUERY_KEY, 'entryReadiness', readerKey] as const
}

/** Root every problem set hangs off, so one call reaches whichever reader and competition it belongs to. */
const COMPETITION_PROBLEMS_QUERY_KEY = [...HOSTED_COMPETITIONS_QUERY_KEY, 'problems'] as const

/**
 * The key one competition's problem set is cached under.
 *
 * @param readerKey - Who the answer is about, since it carries their own conversations.
 * @param competitionId - Which competition's problems these are.
 *
 * @returns The cache key.
 */
export function competitionProblemsQueryKey(
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string
): QueryKey {
  // Every language reads the same answer, the statements arriving in all of them at once
  return [...COMPETITION_PROBLEMS_QUERY_KEY, readerKey, competitionId] as const
}

/**
 * Refreshes every cached problem set, whichever reader or competition it belongs to.
 *
 * The rows under each statement say how many turns a conversation has spent, so anything that writes a
 * conversation moves them.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateCompetitionProblems(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: COMPETITION_PROBLEMS_QUERY_KEY })
}

/**
 * Puts a competition's problem set where the area reads it from.
 *
 * The set comes back with the entry that bought it, so the area opens on the statements.
 *
 * @param queryClient - The React Query cache.
 * @param readerKey - Who the cached set belongs to.
 * @param competitionId - Which competition's problems these are.
 * @param problems - The set, in the order the competition sets them.
 */
export function writeCachedProblems(
  queryClient: QueryClient,
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string,
  problems: HostedCompetitionProblem[]
): void {
  queryClient.setQueryData<HostedCompetitionProblem[]>(
    competitionProblemsQueryKey(readerKey, competitionId),
    problems
  )
}

/**
 * Puts an entry onto its own competition in the cached view.
 *
 * Every press that changes an entry changes exactly one of them, so the screen moves on what came back
 * rather than waiting for the whole view to be fetched again.
 *
 * @param queryClient - The React Query cache.
 * @param readerKey - Who the cached view belongs to.
 * @param competitionId - Which competition the entry belongs to.
 * @param entry - The entry as it now stands.
 */
export function writeCachedEntry(
  queryClient: QueryClient,
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string,
  entry: HostedCompetitionEntry
): void {
  queryClient.setQueryData<HostedCompetitionsView>(
    hostedCompetitionsViewQueryKey(readerKey),
    (view) => {
      // Nothing cached to write into
      if (view === undefined) {
        return view
      }

      // The same view with the entry on its own competition
      return {
        groups: view.groups.map((group) => ({
          ...group,
          competitions: group.competitions.map((competition) =>
            competition.id === competitionId ? { ...competition, entry } : competition
          ),
        })),
      }
    }
  )
}
