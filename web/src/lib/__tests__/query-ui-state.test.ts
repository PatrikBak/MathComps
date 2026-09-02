import { describe, expect, it } from 'vitest'

import { BackendApiError } from '../api/api-error'
import { deriveQueryUiState, isAwaitingAnswer, type QueryUiStateInput } from '../query-ui-state'

/**
 * A query's flags as React Query reports them, defaulting to a first read that has yet to start.
 *
 * @param overrides - Whichever flags the case is actually about.
 *
 * @returns The flags to reduce.
 */
function flags(overrides: Partial<QueryUiStateInput> = {}): QueryUiStateInput {
  // A pending, idle query with nothing behind it, which each case moves off as it needs
  return {
    status: 'pending',
    fetchStatus: 'idle',
    failureCount: 0,
    errorUpdateCount: 0,
    error: null,
    ...overrides,
  }
}

describe('deriveQueryUiState', () => {
  it('reads a query holding data as ready while the connection is down', () => {
    // The reader has results on screen and the browser has gone offline behind them
    const state = deriveQueryUiState(flags({ status: 'success', fetchStatus: 'paused' }))

    // Data outranks the connection: a paused refresh must not blank out what is already readable
    expect(state.kind).toBe('ready')
  })

  it('reads a query holding data as ready while it refreshes', () => {
    // A background refetch over results the reader is already looking at
    const state = deriveQueryUiState(flags({ status: 'success', fetchStatus: 'fetching' }))

    // Same rule: a refresh is not a state the reader should be shown
    expect(state.kind).toBe('ready')
  })

  it('reads a refresh that gave up over data already read as failed', () => {
    // A server fault behind the refresh
    const error = new BackendApiError({ statusCode: 500 })

    // React Query keeps the data and moves the status, so this state is reachable only on a refresh
    const state = deriveQueryUiState(flags({ status: 'error', fetchStatus: 'idle', error }))

    // A surface with rows on screen checks the rows before it reads this, which is what keeps them up
    expect(state.kind).toBe('failed')
  })

  it('reads an attempt following an earlier failure as retrying, not as a first load', () => {
    // Starting a fetch clears the failure count, so only the lifetime count survives into the very
    // attempt the reader asked for by pressing retry
    const state = deriveQueryUiState(
      flags({ fetchStatus: 'fetching', failureCount: 0, errorUpdateCount: 1 })
    )

    // Reading the per-fetch count alone would call this a first load and lose the retry wording
    expect(state.kind).toBe('retrying')
  })

  it('reads a query that has yet to be allowed to run as loading', () => {
    // Nothing in flight and nothing tried: the read is gated behind auth or a dependency
    const state = deriveQueryUiState(flags({ status: 'pending', fetchStatus: 'idle' }))

    // A gated read shows the same skeleton as a first load rather than an empty result
    expect(state.kind).toBe('loading')
  })

  it('carries the settled failure through so its code can be read off', () => {
    // A read the backend refused by name
    const error = new BackendApiError({ statusCode: 404, errorCode: 'ProblemNotFound' })

    // The state that failure reduces to
    const state = deriveQueryUiState(flags({ status: 'error', fetchStatus: 'idle', error }))

    // Surfaces branch on the code, so the failure has to arrive intact rather than as a flag
    expect(state).toEqual({ kind: 'failed', error, isPermanent: true })
  })

  it('marks a failure another attempt could fix as impermanent', () => {
    // A dropped connection, which carries neither a status nor a name
    const error = new BackendApiError({ message: 'Failed to fetch' })

    // The state that failure reduces to
    const state = deriveQueryUiState(flags({ status: 'error', fetchStatus: 'idle', error }))

    // The wording splits on this: a connection problem is worth mentioning as one
    expect(state).toEqual({ kind: 'failed', error, isPermanent: false })
  })
})

describe('isAwaitingAnswer', () => {
  it('reports nothing in flight while the connection holds the read back', () => {
    // The browser is offline before the first read got out
    const offline = deriveQueryUiState(flags({ fetchStatus: 'paused' }))

    // A control waiting on this would wait as long as the reader is offline, so it must not
    expect(isAwaitingAnswer(offline)).toBe(false)
  })

  it('reports a request in flight while one is actually running', () => {
    // A first read on its way
    const loading = deriveQueryUiState(flags({ fetchStatus: 'fetching' }))

    // The one case a spinner is honest about
    expect(isAwaitingAnswer(loading)).toBe(true)
  })
})
