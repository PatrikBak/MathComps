import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, withApiHandler } from '../api-handler'

/**
 * Stand in for error tracking, so a test can read what reached it.
 */
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

/**
 * Stand in for Clerk, which the handler module imports for its signed-in variant.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

/**
 * Runs a route whose handler fails with the given error.
 *
 * @param error - What the handler throws.
 *
 * @returns The response the wrapper answers with.
 */
function answerTo(error: unknown) {
  // A route that fails the moment it runs
  const route = withApiHandler(async () => {
    throw error
  })

  // Its answer to any request
  return route(new NextRequest('http://localhost/api/anything'))
}

beforeEach(() => {
  // Each test reads only its own reports
  vi.mocked(Sentry.captureException).mockClear()

  // Keep a report's log line out of the test output
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('withApiHandler', () => {
  it('keeps a refused request out of error tracking', async () => {
    // A request the route refuses
    const response = await answerTo(new ApiError(400, 'VALIDATION_FAILED'))

    // The refusal is the caller's mistake, which nobody needs paging about
    expect(response.status).toBe(400)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('reports a controlled failure answering 5xx', async () => {
    // A failure the route answers as its own fault, like a send the mail service refused
    const failure = new ApiError(502, 'SERVER_ERROR')

    // The route's answer
    const response = await answerTo(failure)

    // The status survives, and the failure reaches error tracking
    expect(response.status).toBe(502)
    expect(Sentry.captureException).toHaveBeenCalledWith(failure)
  })

  it('reports an unexpected failure and answers 500', async () => {
    // A fault nobody planned for
    const fault = new Error('boom')

    // The route's answer
    const response = await answerTo(fault)

    // It answers as a server error and reaches error tracking
    expect(response.status).toBe(500)
    expect(Sentry.captureException).toHaveBeenCalledWith(fault)
  })
})
