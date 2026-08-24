import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import { handoutTargetOf } from '../model/defense-target'
import type {
  DefenseOutcome,
  DefenseReportCategory,
  DefenseSession,
  DefenseSessionList,
  DefenseSessionListItem,
  DefenseTurnRequest,
} from '../model/defense-types'
import {
  getContinueDefenseUrl,
  getDefenseFeedbackUrl,
  getDefenseSessionsUrl,
  getDeleteDefenseSessionUrl,
  getMyDefenseSessionsUrl,
  getReportDefenseTurnUrl,
  getRewindDefenseUrl,
  getStartDefenseUrl,
} from './defense-api-urls'

/**
 * The backend for defense conversations: authenticated calls to the .NET API. Each function takes an
 * {@link ApiCaller} and returns an {@link ApiResult}; the consumer unwraps it.
 */

/**
 * Lists a handout environment's defense sessions, most recently active first, with the caps a defense
 * against it is held to.
 *
 * @param apiCall - The authenticated API caller.
 * @param target - The handout environment whose sessions these are.
 * @returns The sessions held against the given environment, and the caps they are held to.
 */
export function listSessions(
  apiCall: ApiCaller,
  target: HandoutEnvironmentTarget
): Promise<ApiResult<DefenseSessionList>> {
  return apiCall<DefenseSessionList>(() => getDefenseSessionsUrl(target))
}

/**
 * Lists all of the user's defense sessions across every problem, most recently active first.
 *
 * @param apiCall - The authenticated API caller.
 * @returns The user's sessions across every problem.
 */
export function listMyDefenses(apiCall: ApiCaller): Promise<ApiResult<DefenseSessionListItem[]>> {
  return apiCall<DefenseSessionListItem[]>(() => getMyDefenseSessionsUrl())
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
    // Open a new session against a problem, naming it rather than describing it. This endpoint knows only
    // handout environments, so the environment is what goes on the wire and the discriminant stays here
    case 'start':
      return apiCall<DefenseSession>(() => getStartDefenseUrl(), {
        method: 'POST',
        signal: request.signal,
        body: JSON.stringify({
          target: handoutTargetOf(request.target),
          content: request.content,
        }),
      })
    // Append the student's message to the open session
    case 'continue':
      return apiCall<DefenseSession>(() => getContinueDefenseUrl(request.sessionId), {
        method: 'POST',
        signal: request.signal,
        body: JSON.stringify({ content: request.content }),
      })
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
  return apiCall<void>(() => getDeleteDefenseSessionUrl(sessionId), { method: 'DELETE' })
}

/**
 * Rewinds a session to a chosen point, dropping every turn after it.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The id of the session to rewind.
 * @param keepThroughSequence - The sequence of the last turn to keep; every later turn is deleted.
 * @returns The outcome of the rewind.
 */
export function rewindTurns(
  apiCall: ApiCaller,
  sessionId: string,
  keepThroughSequence: number
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getRewindDefenseUrl(sessionId), {
    method: 'POST',
    body: JSON.stringify({ keepThroughSequence }),
  })
}

/**
 * Records what the student holds against one examiner reply, replacing anything they said before.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The id of the session the reported reply was given in.
 * @param turnId - The id of the reported reply.
 * @param categories - Every way the reply went wrong.
 * @param comment - The student's own account of what went wrong; empty when they gave none.
 * @returns The outcome of the report.
 */
export function reportTurn(
  apiCall: ApiCaller,
  sessionId: string,
  turnId: string,
  categories: readonly DefenseReportCategory[],
  comment: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getReportDefenseTurnUrl(sessionId, turnId), {
    method: 'PUT',
    body: JSON.stringify({ categories, comment }),
  })
}

/**
 * Records what a student says about a whole defense conversation, replacing anything they said
 * before.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The id of the session being answered for.
 * @param outcome - What the examiner did for them.
 * @param comment - What they say in their own words; empty when they let the outcome stand alone.
 * @returns The outcome of the submission.
 */
export function submitFeedback(
  apiCall: ApiCaller,
  sessionId: string,
  outcome: DefenseOutcome,
  comment: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getDefenseFeedbackUrl(sessionId), {
    method: 'PUT',
    body: JSON.stringify({ outcome, comment }),
  })
}

/**
 * Takes back what a student holds against one examiner reply, leaving it carrying nothing.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The id of the session the reply was given in.
 * @param turnId - The id of the reply to stop holding anything against.
 * @returns The outcome of the withdrawal.
 */
export function withdrawTurnReport(
  apiCall: ApiCaller,
  sessionId: string,
  turnId: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getReportDefenseTurnUrl(sessionId, turnId), { method: 'DELETE' })
}

/**
 * Takes back what a student said a whole defense conversation came to, leaving it unanswered.
 *
 * @param apiCall - The authenticated API caller.
 * @param sessionId - The id of the session to leave unanswered.
 * @returns The outcome of the withdrawal.
 */
export function withdrawFeedback(apiCall: ApiCaller, sessionId: string): Promise<ApiResult<void>> {
  return apiCall<void>(() => getDefenseFeedbackUrl(sessionId), { method: 'DELETE' })
}
