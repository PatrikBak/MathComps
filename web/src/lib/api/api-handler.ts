import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { type NodeErrorCode } from './api-error-codes'

/**
 * A controlled route failure carrying an HTTP status and a machine-readable code for client-side copy.
 */
export class ApiError extends Error {
  /**
   * Creates a new {@link ApiError}.
   *
   * @param statusCode - The HTTP status to return.
   * @param errorCode - The machine-readable failure code.
   * @param data - Interpolation values a coded message needs (e.g. `FILE_TOO_LARGE`'s max).
   */
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: NodeErrorCode,
    public readonly data?: Record<string, unknown>
  ) {
    // Use the code as the base message for logging/debugging
    super(errorCode)
    this.name = 'ApiError'
  }
}

/**
 * Builds the JSON error body every route emits: a top-level `errorCode` plus any interpolation values,
 * matching the shape the C# backend and the client parser already speak.
 *
 * @param errorCode - The machine-readable failure code.
 * @param data - Interpolation values a coded message needs.
 *
 * @returns The response body.
 */
function errorBody(errorCode: NodeErrorCode, data?: Record<string, unknown>) {
  // The code rides as a top-level field alongside any interpolation values
  return { errorCode, ...data }
}

/**
 * Base API handler type that receives a request and returns a response.
 */
type ApiHandler = (request: NextRequest) => Promise<NextResponse>

/**
 * Authenticated API handler type that also receives the userId.
 */
type AuthenticatedApiHandler = (request: NextRequest, userId: string) => Promise<NextResponse>

/**
 * Wraps an API route handler with centralized error handling, so every failure returns the same
 * `{ errorCode, ...data }` JSON body.
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
        return NextResponse.json(errorBody(error.errorCode, error.data), {
          status: error.statusCode,
        })
      }

      // A validation failure is a bad request
      if (error instanceof ZodError) {
        return NextResponse.json(errorBody('VALIDATION_FAILED'), { status: 400 })
      }

      // Log unexpected errors so a route failure leaves a trace
      console.error('[API Error]', error)

      // Everything else is an unexpected server error
      return NextResponse.json(errorBody('SERVER_ERROR'), { status: 500 })
    }
  }
}

/**
 * Wraps an API route handler with authentication and error handling. Validates Clerk authentication and
 * passes the userId to the handler.
 *
 * @param handler - The authenticated API route handler function.
 *
 * @returns Wrapped handler with auth check and error handling.
 */
export function withAuth(handler: AuthenticatedApiHandler): ApiHandler {
  return withApiHandler(async (request: NextRequest) => {
    // Get the user ID from Clerk authentication
    const { userId } = await auth()

    // If no user ID is found, throw an authentication error
    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED')
    }

    // Execute the handler with the user ID and return the response
    return handler(request, userId)
  })
}
