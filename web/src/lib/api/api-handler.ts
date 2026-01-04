import { auth } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/**
 * Custom error class for API responses with controlled status codes.
 * Throw this inside handlers for predictable error responses.
 */
export class ApiError extends Error {
  /**
   * Creates a new {@link ApiError} instance.
   *
   * @param statusCode HTTP status code
   * @param message Error message
   */
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
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
 * Wraps an API route handler with centralized error handling.
 * Catches all errors and returns consistent JSON responses.
 *
 * @param handler - The API route handler function
 *
 * @returns Wrapped handler with error handling
 */
export function withApiHandler(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest) => {
    try {
      // Execute the handler and return the response
      return await handler(request)
    } catch (error) {
      // Handle controlled API errors
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode })
      }

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        return NextResponse.json({ error: 'Neplatné údaje vo formulári' }, { status: 400 })
      }

      // Log unexpected errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('[API Error]', error)
      }

      // Generic error for unexpected issues
      return NextResponse.json({ error: 'Chyba servera' }, { status: 500 })
    }
  }
}

/**
 * Wraps an API route handler with authentication and error handling.
 * Automatically validates Clerk authentication and passes userId to handler.
 *
 * @param handler - The authenticated API route handler function
 *
 * @returns Wrapped handler with auth check and error handling
 */
export function withAuth(handler: AuthenticatedApiHandler): ApiHandler {
  return withApiHandler(async (request: NextRequest) => {
    // Get the user ID from Clerk authentication
    const { userId } = await auth()

    // If no user ID is found, throw an authentication error
    if (!userId) {
      throw new ApiError(401, 'Pre túto akciu musíte byť prihlásený')
    }

    // Execute the handler with the user ID and return the response
    return handler(request, userId)
  })
}
