import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '../route'

/**
 * Stand in for error tracking, so a test can read what reached it.
 */
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

/**
 * Stand in for Clerk, which the route's error handling imports for its signed-in variant.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

beforeEach(() => {
  // Each test reads only its own reports
  vi.mocked(Sentry.captureException).mockClear()
})

describe('POST /api/contact', () => {
  it.each(['name=Bot&message=spam', 'null'])(
    'refuses a body the form never sends (%s) without reporting it',
    async (body) => {
      // A post the form could not have made, like a scanner's
      const request = new NextRequest('http://localhost/api/contact', { method: 'POST', body })

      // The route's answer
      const response = await POST(request)

      // A bad request, and nobody gets paged about it
      expect(response.status).toBe(400)
      expect(Sentry.captureException).not.toHaveBeenCalled()
    }
  )
})
