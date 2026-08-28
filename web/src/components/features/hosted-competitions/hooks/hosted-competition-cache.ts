import type { QueryClient, QueryKey } from '@tanstack/react-query'

import type {
  HostedCompetitionEntry,
  HostedCompetitionProblem,
  HostedCompetitionsView,
} from '../model/hosted-competition-types'

/** Root of every query key the competitions surface reads under, so invalidating it reaches them all. */
const HOSTED_COMPETITIONS_QUERY_KEY = ['competitions'] as const

/**
 * Who a cached competitions answer belongs to.
 *
 * Every answer on this surface is somebody's: which entries are on it, what they still owe, what each row
 * offers. Cached under anything less, signing out and back in as somebody else hands the second reader the
 * first one's history.
 *
 * A signed-out visitor has no identity, and holds no entries either.
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

/** Root every student's readiness hangs off, so one call reaches whoever is reading. */
const ENTRY_READINESS_QUERY_KEY = [...HOSTED_COMPETITIONS_QUERY_KEY, 'entryReadiness'] as const

/**
 * The key the student's entry readiness is cached under.
 *
 * @param readerKey - Who the answer is about.
 *
 * @returns The cache key.
 */
export function entryReadinessQueryKey(readerKey: HostedCompetitionsReaderKey): QueryKey {
  // Readiness is about the student rather than the reading, so it carries no language
  return [...ENTRY_READINESS_QUERY_KEY, readerKey] as const
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
 * Narrower than {@link invalidateHostedCompetitions}: it leaves the view and readiness alone. Anything that
 * moves an entry wants that one instead.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateCompetitionProblems(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: COMPETITION_PROBLEMS_QUERY_KEY })
}

/**
 * Refreshes what the program still owes a student before it will take an entry from them.
 *
 * Its answer is read off the account, so anything that writes the account moves it.
 *
 * The narrowest of the invalidators: it leaves the view and the problem sets alone. Anything that moves
 * an entry wants {@link invalidateHostedCompetitions} instead.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateEntryReadiness(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ENTRY_READINESS_QUERY_KEY })
}

/**
 * Refreshes everything the competitions surface reads: the view, what each student still owes, and every
 * problem set.
 *
 * React Query matches a key by prefix, and every key here is built off the same root, so this one call
 * reaches the problem sets too. That is what it is for: an entry that closes changes more than the entry.
 *
 * @param queryClient - The cache to refresh.
 */
export function invalidateHostedCompetitions(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: HOSTED_COMPETITIONS_QUERY_KEY })
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
        ...view,
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

/**
 * Puts what a student claims about one solution onto its own problem in the cached set.
 *
 * @param queryClient - The React Query cache.
 * @param readerKey - Who the cached set belongs to.
 * @param competitionId - Which competition's problems these are.
 * @param problemId - Which problem the claim is about.
 * @param assessment - What they now say, or null once they have taken it back.
 *
 * @returns What stood there before this write, which is what a refused one has to be put back to.
 */
export function writeCachedSelfAssessment(
  queryClient: QueryClient,
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string,
  problemId: string,
  assessment: string | null
): string | null {
  // Where the set is cached, which the read and the write below both go through
  const key = competitionProblemsQueryKey(readerKey, competitionId)

  // What the problem said a moment ago, read off the row rather than taken from the caller: the caller
  // reads it from this same row, so an optimistic write has already moved their copy on by the time a
  // refusal comes back. Absent while nothing has been read, which reads as nothing said
  const previous =
    queryClient
      .getQueryData<HostedCompetitionProblem[]>(key)
      ?.find((problem) => problem.id === problemId)?.selfAssessment ?? null

  // The set with the claim on its own problem, every other one left where it was
  queryClient.setQueryData<HostedCompetitionProblem[]>(key, (problems) =>
    problems?.map((problem) =>
      problem.id === problemId ? { ...problem, selfAssessment: assessment } : problem
    )
  )

  // For whoever has to put it back
  return previous
}
