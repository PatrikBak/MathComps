import { useQueries, useQuery } from '@tanstack/react-query'

import { type ApiState, useApi } from '@/hooks/use-api'
import { apiQueryOptions } from '@/hooks/use-api-query'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { CompetitionResults } from '../model/hosted-competition-types'
import { fetchCompetitionResults } from '../services/hosted-competition-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { competitionResultsQueryKey } from './hosted-competition-cache'
import { useEntryReader } from './use-entry-reader'

/**
 * The read of one competition's results, built the once so that {@link usePreloadCompetitionResults} fills
 * the very key {@link useCompetitionResults} looks at.
 *
 * @param api - The client the read goes through.
 * @param readerKey - Who is reading, since one row of the answer is marked as theirs.
 * @param isReaderKnown - Whether who is reading is settled yet.
 * @param competitionSlug - Which competition, by any of its slugs.
 *
 * @returns The options, ready for `useQuery` or `useQueries`.
 */
function competitionResultsOptions(
  api: ApiState,
  readerKey: HostedCompetitionsReaderKey,
  isReaderKnown: boolean,
  competitionSlug: string
) {
  // The results, read with whatever caller there is: they are public once the group has closed
  return apiQueryOptions(api, {
    queryKey: competitionResultsQueryKey(readerKey, competitionSlug),
    fetch: (apiCall) => fetchCompetitionResults(apiCall, competitionSlug),
    // Read once the reader is settled
    enabled: isReaderKnown,
    // Grading moves the results while they are open
    ...cachePolicy.userData,
  })
}

/**
 * Return type for {@link useCompetitionResults}.
 */
type UseCompetitionResultsResult = {
  /** Everybody's row, once it has arrived. */
  results: CompetitionResults | undefined
  /** How far the read got, for whatever stands in the table's place. */
  uiState: QueryUiState
}

/**
 * Reads one competition's results, as the reader sees them: everybody's row, their own marked as theirs.
 *
 * The rest of its group is read alongside, so moving to another of the group's competitions finds its table
 * already there.
 *
 * @param competitionSlug - Which competition, by any of its slugs.
 * @param groupSlugs - Every competition of its group, each by its slug in the same language.
 *
 * @returns The results and the state of the read.
 */
export function useCompetitionResults(
  competitionSlug: string,
  groupSlugs: string[]
): UseCompetitionResultsResult {
  // Whose reading this is, since one row of the answer is marked as theirs
  const { readerKey, isReaderKnown } = useEntryReader()

  // The API client, which results need nobody signed in behind
  const api = useApi({ requireAuth: false })

  // The results themselves
  const query = useQuery(competitionResultsOptions(api, readerKey, isReaderKnown, competitionSlug))

  // The rest of the group, read alongside the one showing
  usePreloadCompetitionResults(groupSlugs.filter((slug) => slug !== competitionSlug))

  // Reduce the raw flags to the one state that describes this read
  const uiState = useQueryUiState(query)

  // The results and the state of the read
  return { results: query.data, uiState }
}

/**
 * Reads competitions' results ahead of anybody opening them, so opening any of them finds its table already
 * there.
 *
 * @param competitionSlugs - Which competitions, each by any of its slugs.
 */
export function usePreloadCompetitionResults(competitionSlugs: string[]): void {
  // Whose reading this is, since each answer is cached as theirs
  const { readerKey, isReaderKnown } = useEntryReader()

  // The API client, which results need nobody signed in behind
  const api = useApi({ requireAuth: false })

  // Every competition's results, read side by side
  useQueries({
    queries: competitionSlugs.map((slug) =>
      competitionResultsOptions(api, readerKey, isReaderKnown, slug)
    ),
  })
}
