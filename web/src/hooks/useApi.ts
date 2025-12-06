import { useAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

/**
 * Represents a successful API call.
 *
 * @template T - The type of the data returned by the API.
 */
type ApiSuccess<T> = {
  /** Indicates the operation was successful */
  success: true
  /** The data returned by the API */
  data: T
}

/**
 * Represents a failed API call.
 */
type ApiFailure = {
  /** Indicates the operation failed */
  success: false
  /** The error details */
  error: ApiError
}

/**
 * Result type for API calls - discriminated union representing success or error states
 */
type ApiResult<T> = ApiSuccess<T> | ApiFailure

/**
 * Represents an error where the user is not authenticated or the token is invalid.
 */
type UnauthenticatedError = {
  /** Discriminator for unauthenticated errors */
  type: 'unauthenticated'
  /** Error message explaining why authentication failed */
  message: string
}

/**
 * Represents a network or server error (non-2xx response).
 */
type NetworkError = {
  /** Discriminator for network errors */
  type: 'network'
  /** Error message describing the network issue */
  message: string
  /** The HTTP status code returned by the server, if available */
  statusCode?: number
}

/**
 * Represents an unexpected error (e.g., parsing failed, network disconnected).
 */
type UnknownError = {
  /** Discriminator for unknown errors */
  type: 'unknown'
  /** Error message describing the unexpected error */
  message: string
}

/**
 * Discriminated union of all possible API errors.
 */
type ApiError = UnauthenticatedError | NetworkError | UnknownError

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
 * Represents the state of the API client.
 */
type ApiState =
  | { state: 'loading' }
  | { state: 'unauthenticated' }
  | {
      state: 'ready'
      /**
       * Makes an API call (authenticated if user is signed in).
       */
      apiCall: ApiCaller
    }

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

  // Memoize the API call function
  const apiCall = useCallback(
    /**
     * Makes an authenticated API call to the specified endpoint.
     * Automatically includes the Clerk session token in the Authorization header if available.
     *
     * @template T - The expected response data type
     * @param endpoint - A function that returns the API endpoint path
     * @param options - Optional fetch configuration (method, body, headers, etc.)
     * @returns Promise that resolves to an ApiResult<T>
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
          return {
            success: false,
            error: {
              type: 'network',
              message: `API request failed: ${response.statusText}`,
              statusCode: response.status,
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
    [getToken, isSignedIn, requireAuth]
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
