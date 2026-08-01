'use client'

import { useMemo } from 'react'

import type { QueryUiState, QueryUiStateInput } from '@/lib/query-ui-state'
import { deriveQueryUiState } from '@/lib/query-ui-state'

/**
 * Derives a query's {@link QueryUiState} and holds the reference steady while the query's flags stay
 * put, so effects keyed on the state fire on a real transition rather than on every render.
 *
 * @param query - The query result to reduce.
 *
 * @returns The state the UI should render.
 */
export function useQueryUiState({
  status,
  fetchStatus,
  failureCount,
  errorUpdateCount,
  error,
}: QueryUiStateInput): QueryUiState {
  // Recompute only when one of the flags the derivation reads actually moves
  return useMemo(
    () => deriveQueryUiState({ status, fetchStatus, failureCount, errorUpdateCount, error }),
    [status, fetchStatus, failureCount, errorUpdateCount, error]
  )
}
