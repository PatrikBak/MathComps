import type { QueryState } from '@tanstack/react-query'

import { assertNever } from '@/components/shared/utils/assert-never'
import { SECOND_MS } from '@/components/shared/utils/time-units'
import { errorCodeOf } from '@/lib/api/api-error'
import type { AppErrorCode } from '@/lib/api/api-error-codes'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { NamedDefenseTarget, PhotoHandoffCheck } from './defense-types'

/**
 * How often a phone holding a handoff code asks which problem its photos go to.
 */
export const HANDOFF_POLL_MS = 3 * SECOND_MS

/**
 * A code that works, sending photos to a problem.
 */
type LiveHandoff = {
  /** The discriminant. */
  kind: 'live'
  /** The problem photos go to now. */
  target: NamedDefenseTarget
}

/**
 * A code that never worked or has run out.
 */
type DeadHandoff = {
  /** The discriminant. */
  kind: 'dead'
}

/**
 * A code whose first check has not come back yet.
 */
type CheckingHandoff = {
  /** The discriminant. */
  kind: 'checking'
  /** How far the check has got. */
  uiState: Extract<QueryUiState, { kind: 'loading' | 'retrying' | 'offline' }>
}

/**
 * A code whose first check gave up for a reason other than the code.
 */
type CheckFailedHandoff = {
  /** The discriminant. */
  kind: 'checkFailed'
  /** Why the check gave up, or undefined when nothing said why. */
  errorCode: AppErrorCode | undefined
  /** Checks again. */
  retry: () => void
}

/**
 * Where a handoff code stands, as far as the phone holding it knows.
 */
export type PhotoHandoffState = LiveHandoff | DeadHandoff | CheckingHandoff | CheckFailedHandoff

/**
 * A check's query, as much of it as decides whether to make it again.
 */
type HandoffCheckQuery = {
  /** How the check stands: what it last brought, what it last failed with, and which, if either, it settled on. */
  state: Pick<QueryState, 'data' | 'error' | 'status'>
}

/**
 * Whether a check's failure says the code doesn't work, which nothing asked again can change.
 *
 * @param error - What the check failed with, if anything.
 *
 * @returns Whether the code is dead.
 */
function isDeadCode(error: unknown): boolean {
  // The API's own word for an unknown or expired code
  return errorCodeOf(error) === 'DefensePhotoHandoffNotFound'
}

/**
 * How long until a handoff's check is made again on its beat, if it is. A dead code is never asked about again,
 * and a first check that gave up waits until something else asks. Any other failure, a refusal for asking too often
 * included, keeps the beat going, so the code's problem is followed again once the API answers.
 *
 * @param query - The check's query.
 *
 * @returns How long until the next check, or false for none.
 */
export function handoffCheckInterval(query: HandoffCheckQuery): number | false {
  // Nothing will change a dead code
  if (isDeadCode(query.state.error)) return false

  // A first check that gave up shows its failure until somebody asks again
  if (query.state.data === undefined && query.state.status === 'error') return false

  // Otherwise on the beat
  return HANDOFF_POLL_MS
}

/**
 * Whether a handoff's check is made again on coming back to the page or regaining the connection: always, but for
 * a dead code.
 *
 * @param query - The check's query.
 *
 * @returns Whether to check again.
 */
export function checksHandoffOnReturn(query: HandoffCheckQuery): boolean {
  // Anything but a code the API has called dead
  return !isDeadCode(query.state.error)
}

/**
 * Where a handoff code stands, from how its checks have gone.
 *
 * @param uiState - How the latest check stands.
 * @param check - What the latest check that landed said, or undefined while none has.
 * @param retry - Checks again.
 *
 * @returns Where the code stands.
 */
export function photoHandoffStateOf(
  uiState: QueryUiState,
  check: PhotoHandoffCheck | undefined,
  retry: () => void
): PhotoHandoffState {
  // The API called the code dead, which outweighs whatever an earlier check said
  if (uiState.kind === 'failed' && isDeadCode(uiState.error)) return { kind: 'dead' }

  // A check that landed, the latest of them naming the problem
  if (check !== undefined) return { kind: 'live', target: check.handoff.target }

  // No check landed yet, by how far the first one has got
  switch (uiState.kind) {
    // Still to come back, sent or waiting on the connection
    case 'loading':
    case 'retrying':
    case 'offline':
      return { kind: 'checking', uiState }

    // Given up for a reason other than the code
    case 'failed':
      return { kind: 'checkFailed', errorCode: errorCodeOf(uiState.error), retry }

    // Ready always brings a check, so one missing here still reads as waiting for it
    case 'ready':
      return { kind: 'checking', uiState: { kind: 'loading' } }

    // Every state is handled above
    default:
      return assertNever(uiState)
  }
}
