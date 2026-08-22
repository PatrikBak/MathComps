'use client'

import { useQuery } from '@tanstack/react-query'

import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { unwrap } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { HostedCompetitionsView } from '../model/hosted-competition-types'
import { fetchHostedCompetitionsView } from '../services/hosted-competition-mock-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { hostedCompetitionsViewQueryKey } from './hosted-competition-cache'

/**
 * Return type for {@link useHostedCompetitionsView}.
 */
type UseHostedCompetitionsViewResult = {
  /** What a student can enter now and what they have behind them, once it has arrived. */
  view: HostedCompetitionsView | undefined
  /** How far the read got, for whatever stands in the surface's place. */
  uiState: QueryUiState
}

/**
 * The student's own standing with the program: the group taking entries, and every one that has closed.
 *
 * One read rather than two, so a half-arrived page cannot show a history with the open group missing.
 *
 * @param isSignedIn - Whether anybody is signed in to have a history at all.
 * @param readerKey - Who the answer belongs to, which is what it gets cached under.
 * @param isReaderKnown - Whether who the answer belongs to is settled yet.
 *
 * @returns The view and the state of the read.
 */
export function useHostedCompetitionsView(
  isSignedIn: boolean,
  readerKey: HostedCompetitionsReaderKey,
  isReaderKnown: boolean
): UseHostedCompetitionsViewResult {
  // What the student can enter, and what they have behind them
  const query = useQuery({
    queryKey: hostedCompetitionsViewQueryKey(readerKey),
    queryFn: async () => {
      // The view, or throwing the backend failure
      return unwrap(await fetchHostedCompetitionsView())
    },
    // An entry belongs to whoever took it, and a signed-out visitor has taken none
    select: (view) => (isSignedIn ? view : withoutEntries(view)),
    // Nothing is read until it is known whose answer it would be
    enabled: isReaderKnown,
    // An entry taken on another tab should show up here promptly
    ...cachePolicy.userData,
  })

  // How far the read got
  const uiState = useQueryUiState(query)

  // The view and the state of the read
  return { view: query.data, uiState }
}

/**
 * The same competitions with nobody's history on them.
 *
 * The mocked backend answers the same thing to everybody, where the real one would only ever hand a
 * student their own entries.
 *
 * @param view - The view as it was answered.
 *
 * @returns The view with every entry dropped.
 */
function withoutEntries(view: HostedCompetitionsView): HostedCompetitionsView {
  // The same groups and competitions, none of them holding an entry
  return {
    groups: view.groups.map((group) => ({
      ...group,
      competitions: group.competitions.map((competition) => ({ ...competition, entry: null })),
    })),
  }
}
