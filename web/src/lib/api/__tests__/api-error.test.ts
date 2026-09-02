import { describe, expect, it } from 'vitest'

import { BackendApiError, isTransientFailure } from '../api-error'

describe('isTransientFailure', () => {
  it('treats a failure that never reached the server as transient when nothing named it', () => {
    // A dropped connection: no status came back, and the client had no name for what went wrong
    const dropped = new BackendApiError({ message: 'Failed to fetch' })

    // Another attempt is exactly what this case is for
    expect(isTransientFailure(dropped)).toBe(true)
  })

  it('treats a failure the client named itself as permanent', () => {
    // Nobody is signed in, which the caller establishes without asking the server
    const signedOut = new BackendApiError({ errorCode: 'Unauthenticated' })

    // Repeating the call changes nothing, so it must not be retried or read as a connection problem
    expect(isTransientFailure(signedOut)).toBe(false)
  })

  it('treats a refused request as permanent', () => {
    // The server's verdict that the request itself is wrong
    const refused = new BackendApiError({ statusCode: 404, errorCode: 'ProblemNotFound' })

    // Sending it again can only be refused the same way
    expect(isTransientFailure(refused)).toBe(false)
  })

  it('treats a rejected request as permanent at the bottom of the client-error range', () => {
    // The lower boundary of the range the server refuses on
    const rejected = new BackendApiError({ statusCode: 400 })

    // Sending it again can only be refused the same way
    expect(isTransientFailure(rejected)).toBe(false)
  })

  it('treats a server fault as transient at the bottom of the server-error range', () => {
    // The upper boundary: the first status that is the server's problem rather than the request's
    const serverFault = new BackendApiError({ statusCode: 500 })

    // Worth asking again
    expect(isTransientFailure(serverFault)).toBe(true)
  })

  it('treats a thrown value that is not a backend failure as transient', () => {
    // Something else entirely, carrying neither a status nor a code
    const opaque = new Error('boom')

    // An opaque fault says nothing about whether it would happen again
    expect(isTransientFailure(opaque)).toBe(true)
  })
})
