import { assertNever } from '@/components/shared/utils/assert-never'
import type { ApiCaller } from '@/hooks/use-api'
import { wrapApi } from '@/lib/api-utils'
import type { ApiResult } from '@/types/api'

import type { DefenseSession, DefenseTurnRequest } from '../model/defense-types'
import {
  getContinueDefenseUrl,
  getDefenseSessionsUrl,
  getDeleteDefenseSessionUrl,
  getStartDefenseUrl,
} from './defense-api-urls'

/**
 * The backend for defense conversations: authenticated calls to the .NET API. Each function takes an
 * {@link ApiCaller} and returns an {@link ApiResult}; the consumer unwraps it.
 */

/**
 * Lists a problem's defense sessions, oldest first.
 *
 * @param apiCall - The authenticated API caller.
 * @param problemKey - The stable key of the problem whose sessions these are.
 * @returns The sessions held about the given problem.
 */
export function listSessions(
  apiCall: ApiCaller,
  problemKey: string
): Promise<ApiResult<DefenseSession[]>> {
  return wrapApi(apiCall<DefenseSession[]>(() => getDefenseSessionsUrl(problemKey)))
}

/**
 * Advances a defense conversation by one turn: sends the student's turn and returns the session grown
 * with it and the examiner's reply. A `start` request opens a new session; a `continue` request appends
 * to an open one.
 *
 * @param apiCall - The authenticated API caller.
 * @param request - The turn to submit and the context to answer it over.
 * @returns The updated session.
 */
export function submitTurn(
  apiCall: ApiCaller,
  request: DefenseTurnRequest
): Promise<ApiResult<DefenseSession>> {
  switch (request.kind) {
    // Open a new session with the problem, its reference, the opener, and the student's first message
    case 'start':
      return wrapApi(
        apiCall<DefenseSession>(() => getStartDefenseUrl(), {
          method: 'POST',
          signal: request.signal,
          body: JSON.stringify({
            problemKey: request.problemKey,
            statement: request.statement,
            reference: request.reference,
            opener: request.opener,
            content: request.content,
          }),
        })
      )
    // Append the student's message to the open session
    case 'continue':
      return wrapApi(
        apiCall<DefenseSession>(() => getContinueDefenseUrl(request.sessionId), {
          method: 'POST',
          signal: request.signal,
          body: JSON.stringify({ content: request.content }),
        })
      )
    // Every request kind is handled above
    default:
      return assertNever(request)
  }
}

/**
 * Deletes a session.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The id of the session to delete.
 * @returns The outcome of the delete.
 */
export function deleteSession(apiCall: ApiCaller, sessionId: string): Promise<ApiResult<void>> {
  return wrapApi(apiCall<void>(() => getDeleteDefenseSessionUrl(sessionId), { method: 'DELETE' }))
}
