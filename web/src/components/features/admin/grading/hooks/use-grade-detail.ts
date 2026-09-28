import { useApiQuery } from '@/hooks/use-api-query'
import { BackendApiError } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { GradeDetail, GradingPair } from '../model/grading-types'
import { fetchGradeDetail } from '../services/grading-service'
import { gradeDetailQueryKey } from './grading-cache'

/** Stands in for the ids in the query key while no pair is open. */
const NO_PAIR = 'none'

/**
 * What {@link useGradeDetail} hands back.
 */
type UseGradeDetailResult = {
  /** Everything the open pair's grade is read from; null until it has been read. */
  detail: GradeDetail | null
  /** The state of the fetch. */
  uiState: QueryUiState
}

/**
 * Reads everything one entrant's grade on one problem is read from.
 *
 * @param pair - The entrant and problem, or null while none is open.
 * @returns The detail as described by {@link UseGradeDetailResult}.
 */
export function useGradeDetail(pair: GradingPair | null): UseGradeDetailResult {
  // The entrant's conversations about the problem, and what they said about their solution
  const { data: detail, uiState } = useApiQuery({
    queryKey: gradeDetailQueryKey(pair?.problem.id ?? NO_PAIR, pair?.user.id ?? NO_PAIR),
    fetch: (apiCall) => {
      // The gate below keeps this from running with nothing open, so reaching here is a bug
      if (pair === null) {
        throw new BackendApiError({ message: 'No pair is open', errorCode: 'SERVER_ERROR' })
      }

      // The detail of the open pair
      return fetchGradeDetail(apiCall, pair.problem.id, pair.user.id)
    },
    // The detail is an admin's own read, so it is made as them
    requireAuth: true,
    // Nothing is read while no pair is open
    enabled: pair !== null,
    ...cachePolicy.userData,
  })

  // The detail once it has arrived, and how the fetch is going meanwhile
  return { detail: detail ?? null, uiState }
}
