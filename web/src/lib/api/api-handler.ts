import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { reportError } from '@/lib/error-reporting/report-error'

import { type WebErrorCode } from './api-error-codes'

/**
 * A controlled route failure carrying an HTTP status and a machine-readable code for client-side copy.
 */
export class ApiError extends Error {
  /**
   * Creates a new {@link ApiError}.
   *
   * @param statusCode - The HTTP status to return.
   * @param errorCode - The machine-readable failure code.
   */
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: WebErrorCode
  ) {
    // Use the code as the base message for logging/debugging
    super(errorCode)
    this.name = 'ApiError'
  }
}

/**
 * Base API handler type that receives a request and returns a response.
 */
type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Wraps an API route handler with centralized error handling, so every failure returns the same
 * `{ errorCode }` JSON body. A failure that is ours, a 5xx or anything unexpected, is reported.
 *
 * @param handler - The API route handler function.
 *
 * @returns Wrapped handler with error handling.
 */
export function withApiHandler(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest) => {
    try {
      // Execute the handler and return the response
      return await handler(request)
    } catch (error) {
      // A controlled failure carries its own status and code
      if (error instanceof ApiError) {
        // A 5xx is ours to fix, so it is reported
        if (error.statusCode >= 500) {
          await reportError(error)
        }

        // Answer with the failure's own status and code
        return NextResponse.json(
          { errorCode: error.errorCode },
          {
            status: error.statusCode,
          }
        )
      }

      // A validation failure is a bad request
      if (error instanceof ZodError) {
        return NextResponse.json(
          { errorCode: 'VALIDATION_FAILED' satisfies WebErrorCode },
          { status: 400 }
        )
      }

      // An unexpected failure is a bug, so it is reported
      await reportError(error)

      // Everything else is an unexpected server error
      return NextResponse.json(
        { errorCode: 'SERVER_ERROR' satisfies WebErrorCode },
        { status: 500 }
      )
    }
  }
}
