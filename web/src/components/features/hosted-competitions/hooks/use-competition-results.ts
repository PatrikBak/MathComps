import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { CompetitionResults } from '../model/hosted-competition-types'
import { fetchCompetitionResults } from '../services/hosted-competition-service'
import { competitionResultsQueryKey } from './hosted-competition-cache'
import { useEntryReader } from './use-entry-reader'

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
 * @param competitionSlug - Which competition, by any of its slugs.
 *
 * @returns The results and the state of the read.
 */
export function useCompetitionResults(competitionSlug: string): UseCompetitionResultsResult {
  // Whose reading this is, since one row of the answer is marked as theirs
  const { readerKey, isReaderKnown } = useEntryReader()

  // The results themselves
  const { data: results, uiState } = useApiQuery({
    queryKey: competitionResultsQueryKey(readerKey, competitionSlug),
    fetch: (apiCall) => fetchCompetitionResults(apiCall, competitionSlug),
    // Public once the group has closed
    requireAuth: false,
    // Read once the reader is settled
    enabled: isReaderKnown,
    // Grading moves the results while they are open
    ...cachePolicy.userData,
  })

  // The results and the state of the read
  return { results, uiState }
}
