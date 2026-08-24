'use client'

import { useQuery } from '@tanstack/react-query'

import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { unwrap } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { HostedCompetitionProblem } from '../model/hosted-competition-types'
import { fetchCompetitionProblems } from '../services/competition-run-mock-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { competitionProblemsQueryKey } from './hosted-competition-cache'

/**
 * Return type for {@link useCompetitionProblems}.
 */
type UseCompetitionProblemsResult = {
  /** The competition's problems in the order it sets them, once they have arrived. */
  problems: HostedCompetitionProblem[] | undefined
  /** How far the read got, for whatever stands in the surface's place. */
  uiState: QueryUiState
}

/**
 * How one competition's problem set is read.
 *
 * @param readerKey - Who the answer belongs to, which is what it gets cached under.
 * @param competitionId - Which competition's problems to read.
 *
 * @returns The query.
 */
function competitionProblemsQuery(readerKey: HostedCompetitionsReaderKey, competitionId: string) {
  // The read, keyed per reader and competition
  return {
    queryKey: competitionProblemsQueryKey(readerKey, competitionId),
    queryFn: async () => {
      // The problems, or throwing the backend failure
      return unwrap(await fetchCompetitionProblems(competitionId))
    },
    // A conversation held on another tab should show up here promptly
    ...cachePolicy.userData,
  }
}

/**
 * One competition's problem set, with whatever the entrant has said about each of them.
 *
 * @param readerKey - Who the answer belongs to, which is what it gets cached under.
 * @param competitionId - Which competition's problems to read.
 * @param isEntitled - Whether the reader has an entry these problems are theirs to see through.
 *
 * @returns The problems and the state of the read.
 */
export function useCompetitionProblems(
  readerKey: HostedCompetitionsReaderKey,
  competitionId: string,
  isEntitled: boolean
): UseCompetitionProblemsResult {
  // The set, each problem carrying its own conversations
  const query = useQuery({
    ...competitionProblemsQuery(readerKey, competitionId),
    // Embargoed until an entry is spent on them, so nothing is asked for before there is one
    enabled: isEntitled,
  })

  // How far the read got
  const uiState = useQueryUiState(query)

  // The problems and the state of the read
  return { problems: query.data, uiState }
}
