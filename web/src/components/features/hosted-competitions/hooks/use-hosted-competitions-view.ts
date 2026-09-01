'use client'

import { useApiQuery } from '@/hooks/use-api-query'
import { useQueryUiState } from '@/hooks/use-query-ui-state'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { HostedCompetitionsView } from '../model/hosted-competition-types'
import { fetchHostedCompetitionsView } from '../services/hosted-competition-service'
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
 * Every group the program has run, is running, or has announced, each competition carrying whatever the
 * reader has entered.
 *
 * One read rather than two, so a half-arrived page cannot show a history with the open group missing.
 *
 * @param readerKey - Who the answer belongs to, which is what it gets cached under.
 * @param shouldRead - Whether to read it at all.
 *
 * @returns The view and the state of the read.
 */
export function useHostedCompetitionsView(
  readerKey: HostedCompetitionsReaderKey,
  shouldRead: boolean
): UseHostedCompetitionsViewResult {
  // What the student can enter, and what they have behind them. Only the caller's own entries are ever
  // on it, so a signed-out visitor reads the groups and no history
  const query = useApiQuery({
    queryKey: hostedCompetitionsViewQueryKey(readerKey),
    fetch: fetchHostedCompetitionsView,
    // The groups are public, so this one read does not wait on an account
    requireAuth: false,
    // Nothing is read until a caller asks for it
    enabled: shouldRead,
    // An entry taken on another tab should show up here promptly
    ...cachePolicy.userData,
  })

  // How far the read got
  const uiState = useQueryUiState(query)

  // The view and the state of the read
  return { view: query.data, uiState }
}
