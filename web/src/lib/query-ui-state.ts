import type { FetchStatus, QueryStatus } from '@tanstack/react-query'

import { assertNever } from '@/components/shared/utils/assert-never'
import { isTransientFailure } from '@/lib/api/api-error'

/**
 * The live state of a query, reduced to the distinctions a UI has to make.
 *
 * This describes the FETCH, not what to render: a consumer holding cached data decides for itself
 * whether a non-ready state is allowed to take over the screen.
 */
export type QueryUiState =
  | QueryUiReady
  | QueryUiOffline
  | QueryUiRetrying
  | QueryUiLoading
  | QueryUiFailed

/**
 * Data is available. Any fetch still in flight is a background refresh the reader needn't know about.
 */
type QueryUiReady = {
  /** The discriminant. */
  kind: 'ready'
}

/**
 * The browser is offline, so the request has not been sent. It resumes on its own once the
 * connection returns, which makes this the one state where promising recovery is honest.
 */
type QueryUiOffline = {
  /** The discriminant. */
  kind: 'offline'
}

/**
 * A request is genuinely in flight after an earlier attempt failed.
 */
type QueryUiRetrying = {
  /** The discriminant. */
  kind: 'retrying'
}

/**
 * A first request is in flight, or has yet to start because the query is still gated.
 */
type QueryUiLoading = {
  /** The discriminant. */
  kind: 'loading'
}

/**
 * Every attempt is spent and nothing is in flight. Only a new trigger changes this.
 */
type QueryUiFailed = {
  /** The discriminant. */
  kind: 'failed'
  /** The failure the query settled on, as React Query reported it. */
  error: Error | null
  /** Whether the request was refused rather than unreachable, which needs different wording. */
  isPermanent: boolean
}

/**
 * The parts of a query result that decide its {@link QueryUiState}.
 */
export type QueryUiStateInput = {
  /** Whether the query has data, an error, or neither yet. */
  status: QueryStatus
  /** Whether a request is in flight, waiting on the network, or idle. */
  fetchStatus: FetchStatus
  /** How many times the current fetch has failed. */
  failureCount: number
  /** How many times the query has settled on an error over its whole life. */
  errorUpdateCount: number
  /** The error the query settled on, or null. */
  error: Error | null
}

/**
 * Whether a request is on its way, first attempt or otherwise. False once an answer arrived, once the
 * read gave up, and while the connection holds it back, since none of those three ends on its own.
 *
 * This is the boolean for a surface with nowhere to put a five-way state. Anything that renders a
 * placeholder switches on {@link QueryUiState} and says what each of offline, retrying and failed looks
 * like.
 *
 * @param uiState - How far the read has got.
 *
 * @returns Whether something is in flight.
 */
export function isAwaitingAnswer(uiState: QueryUiState): boolean {
  switch (uiState.kind) {
    // An answer arrived
    case 'ready':
      return false

    // Every attempt is spent, so nothing further is coming on its own
    case 'failed':
      return false

    // A request is in flight, first time or otherwise
    case 'loading':
    case 'retrying':
      return true

    // Nothing is in flight, and nothing will be until the connection returns
    case 'offline':
      return false

    // Every state is handled above
    default:
      return assertNever(uiState)
  }
}

/**
 * Reduces a query's raw flags to the state its UI should reflect.
 *
 * The point of the exercise is that a spinner may only be shown while a request is actually in
 * flight. React Query keeps `failureCount` above zero after it stops retrying, so reading that flag
 * alone reports a query that gave up minutes ago as still trying.
 *
 * @param input - The query's live flags.
 *
 * @returns The state the UI should render.
 */
export function deriveQueryUiState(input: QueryUiStateInput): QueryUiState {
  // Data wins over a fetch that is merely slow: a background refresh in flight, or held back by the
  // connection, must never blank out content the reader can already see. A refresh that gives up does
  // report as failed, since React Query keeps the data and moves the status
  if (input.status === 'success') {
    return { kind: 'ready' }
  }

  // Otherwise the fetch status says whether anything is actually happening
  switch (input.fetchStatus) {
    // React Query holds the request back until the connection returns
    case 'paused':
      return { kind: 'offline' }

    // A request is in flight, and it counts as a retry once anything has failed before it. Starting
    // a fetch clears the failure count, and the error and the status along with it while the query
    // holds no data, so the lifetime error count is the half of the test that survives into the very
    // attempt a reader asked for
    case 'fetching':
      return input.failureCount > 0 || input.errorUpdateCount > 0
        ? { kind: 'retrying' }
        : { kind: 'loading' }

    // Nothing in flight, so the query has either settled or not started
    case 'idle':
      return deriveIdleState(input)

    // Every fetch status is handled above
    default:
      return assertNever(input.fetchStatus)
  }
}

/**
 * Resolves a query that has nothing in flight.
 *
 * @param input - The query's live flags.
 *
 * @returns The failed state once the query has settled on an error, the loading state otherwise.
 */
function deriveIdleState(input: QueryUiStateInput): QueryUiState {
  // With no attempt running, whether one has already been spent is the whole question
  switch (input.status) {
    // Settled on an error with no attempt left to run
    case 'error':
      return {
        kind: 'failed',
        error: input.error,
        isPermanent: !isTransientFailure(input.error),
      }

    // Idle and still pending means the query is gated (auth or a dependency), so nothing has been
    // tried yet and the reader should see the same skeleton as a first load
    case 'pending':
      return { kind: 'loading' }

    // The success case returns before this helper is reached
    case 'success':
      return { kind: 'ready' }

    // Every status is handled above
    default:
      return assertNever(input.status)
  }
}
