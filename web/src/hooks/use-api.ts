import { useAuth } from '@clerk/nextjs'
import { useLocale } from 'next-intl'
import { useCallback } from 'react'

import type { ApiResult } from '@/types/api'
import { BACKEND_ERROR_CODES, type BackendErrorCode } from '@/types/backend-error-codes'

/**
 * Reads the backend's machine-readable failure code from a problem response body, if present.
 *
 * @param response - The non-OK fetch response.
 * @returns The failure code, or undefined when the body carries none or can't be parsed.
 */
async function readErrorCode(response: Response): Promise<BackendErrorCode | undefined> {
  try {
    // Problem responses are JSON
    const body = await response.json()

    // The code rides as a top-level extension member
    const errorCode = (body as { errorCode?: unknown }).errorCode

    // Only a code the frontend knows counts; an unknown or non-string value means none
    return (BACKEND_ERROR_CODES as readonly string[]).includes(errorCode as string)
      ? (errorCode as BackendErrorCode)
      : undefined
  } catch {
    // A missing or non-JSON body just means no code
    return undefined
  }
}

/**
 * Type definition for the apiCall function.
 *
 * @template T - The type of the data returned by the API.
 *
 * @param endpoint - A function that returns the API endpoint path.
 * @param options - Optional fetch configuration (method, body, headers, etc.).
 *
 * @returns A promise that resolves to an {@link ApiResult<T>}.
 */
export type ApiCaller = <T>(endpoint: () => string, options?: RequestInit) => Promise<ApiResult<T>>

/**
 * The API client is still initializing (Clerk auth state not yet loaded).
 */
type ApiLoadingState = {
  /** The discriminator */
  state: 'loading'
}

/**
 * The API client needs a signed-in user but none is present.
 */
type ApiUnauthenticatedState = {
  /** The discriminator */
  state: 'unauthenticated'
}

/**
 * The API client is ready to issue requests.
 */
type ApiReadyState = {
  /** The discriminator */
  state: 'ready'
  /** Makes an API call (authenticated if the user is signed in). */
  apiCall: ApiCaller
}

/**
 * Represents the state of the API client.
 */
export type ApiState = ApiLoadingState | ApiUnauthenticatedState | ApiReadyState

/**
 * Configuration options for the API client.
 */
type ApiOptions = {
  /**
   * Whether to require authentication.
   * If true (default), the hook will return 'unauthenticated' state if the user is not signed in.
   * If false, the hook will return 'ready' state even if the user is not signed in,
   * and apiCall will attempt to fetch without a token.
   */
  requireAuth?: boolean
}

/**
 * API client hook that provides authenticated fetch with automatic token injection.
 * Handles authentication state and provides type-safe error handling.
 *
 * @param options - Configuration options
 * @returns The current state of the API client (loading, unauthenticated, or ready with apiCall)
 */
export function useApi({ requireAuth = true }: ApiOptions = {}): ApiState {
  // Use Clerk hooks to get authentication state
  const { getToken, isLoaded, isSignedIn } = useAuth()

  // Get current locale for Accept-Language header
  const locale = useLocale()

  // Memoize the API call function
  const apiCall = useCallback(
    /**
     * Makes an authenticated API call to the specified endpoint.
     * Automatically includes the Clerk session token in the Authorization header if available.
     *
     * @template T - The expected response data type
     * @param endpoint - A function that returns the API endpoint path
     * @param options - Optional fetch configuration (method, body, headers, etc.)
     * @returns Promise that resolves to an {@link ApiResult<T>}
     */
    async <T>(endpoint: () => string, options: RequestInit = {}): Promise<ApiResult<T>> => {
      // Check if user is authenticated (if enforcement is enabled)
      if (requireAuth && !isSignedIn) {
        return {
          success: false,
          error: {
            type: 'unauthenticated',
            message: 'User is not signed in. Please authenticate first.',
          },
        }
      }

      try {
        // Get the session token from Clerk if signed in
        const token: string | null = isSignedIn ? await getToken() : null

        // If enforcement is enabled and we failed to get a token, error out
        if (requireAuth && !token) {
          return {
            success: false,
            error: {
              type: 'unauthenticated',
              message: 'Failed to retrieve authentication token.',
            },
          }
        }

        // Prepare headers
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept-Language': locale,
          ...options.headers,
        }

        // Add Authorization header if token exists
        if (token) {
          ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
        }

        // Make the authenticated (or anonymous) request
        const response = await fetch(endpoint(), {
          ...options,
          headers,
        })

        // Handle non-OK responses
        if (!response.ok) {
          // Best-effort read of the problem body for the backend's machine-readable failure code
          const errorCode = await readErrorCode(response)

          return {
            success: false,
            error: {
              type: 'network',
              message: `API request failed: ${response.statusText}`,
              statusCode: response.status,
              errorCode,
            },
          }
        }

        // Parse and return successful response

        // Check if response has content before parsing JSON
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.indexOf('application/json') !== -1) {
          // If JSON, parse and return
          const data = await response.json()
          return { success: true, data }
        }
        // If not JSON (e.g. 204 No Content), return empty object cast as T
        else {
          return { success: true, data: {} as T }
        }
      } catch (error) {
        // Handle network errors, JSON parsing errors, etc.
        return {
          success: false,
          error: {
            type: 'unknown',
            message: error instanceof Error ? error.message : 'An unknown error occurred',
          },
        }
      }
    },
    [getToken, isSignedIn, requireAuth, locale]
  )

  // Still loading Clerk's data
  if (!isLoaded) {
    return { state: 'loading' }
  }

  // Oops, user is not signed in (and we are enforcing it)
  if (requireAuth && !isSignedIn) {
    return { state: 'unauthenticated' }
  }

  // We're authenticated (or allowing anonymous) and makes sense to return the API call function
  return {
    state: 'ready',
    apiCall,
  }
}

/**
 * Narrows the API client to its request caller, throwing when the client isn't ready to issue requests.
 * A query's `enabled` flag should already gate on readiness; this is the safety net inside the query
 * function that also lets the client narrow to a non-nullable {@link ApiCaller}.
 *
 * @param api - The current API client state.
 *
 * @returns The caller for issuing requests.
 */
export function readyApiCall(api: ApiState): ApiCaller {
  // A ready client is required to issue a request
  if (api.state !== 'ready') {
    throw new Error('API not ready')
  }

  // The ready client's caller
  return api.apiCall
}
