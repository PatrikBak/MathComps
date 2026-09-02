'use client'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { HostedCompetitionProblem } from '../model/hosted-competition-types'
import { fetchCompetitionProblems } from '../services/hosted-competition-service'
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
 * One competition's problem set, with whatever the entrant has said about each of them.
 *
 * @param readerKey - Who the answer belongs to, which is what it gets cached under.
 * @param competitionSlug - Which competition's problems to read.
 * @param isEntitled - Whether the problems are the reader's to see, through an entry or through the
 *   competition having closed with them made public.
 *
 * @returns The problems and the state of the read.
 */
export function useCompetitionProblems(
  readerKey: HostedCompetitionsReaderKey,
  competitionSlug: string,
  isEntitled: boolean
): UseCompetitionProblemsResult {
  // The set, each problem carrying its own conversations, keyed per reader and competition
  const { data: problems, uiState } = useApiQuery<HostedCompetitionProblem[]>({
    queryKey: competitionProblemsQueryKey(readerKey, competitionSlug),
    fetch: (apiCall) => fetchCompetitionProblems(apiCall, competitionSlug),
    // A closed competition's set is public, so this read does not wait on an account
    requireAuth: false,
    // Embargoed until an entry is spent on them, so nothing is asked for before there is one
    enabled: isEntitled,
    // A conversation held on another tab should show up here promptly
    ...cachePolicy.userData,
  })

  // The problems and the state of the read
  return { problems, uiState }
}
