import { useAuth } from '@clerk/nextjs'
import { useLocale } from 'next-intl'
import { useCallback } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'
import { BackendApiError } from '@/lib/api/api-error'
import { readErrorCode } from '@/lib/api/api-error-codes'
import type { ApiResult } from '@/types/api'

/**
 * The authenticated API caller. It owns the total error catch: every failure (not signed in, a non-OK
 * response, a fetch or parse throw) resolves as an {@link ApiResult} failure. It never rejects, so a
 * caller branches on `success` (or hands the result to `unwrap`), never a try/catch.
 *
 * @template T - What the endpoint answers with.
 *
 * @param endpoint - Builds the path to call, read at request time.
 * @param options - The method, body and headers to send.
 *
 * @returns The settled result of the call.
 */
export type ApiCaller = <T>(endpoint: () => string, options?: RequestInit) => Promise<ApiResult<T>>

/**
 * Clerk has yet to settle who is asking, so the client has no caller to give out.
 */
type ApiLoadingState = {
  /** The discriminant. */
  state: 'loading'
}

/**
 * The client needs a signed-in user and has none.
 */
type ApiUnauthenticatedState = {
  /** The discriminant. */
  state: 'unauthenticated'
}

/**
 * The client is ready to issue requests.
 */
type ApiReadyState = {
  /** The discriminant. */
  state: 'ready'
  /** The caller for issuing requests, authenticated whenever a signed-in user is behind it. */
  apiCall: ApiCaller
}

/**
 * How far the API client has got: waiting on Clerk, held shut for want of a signed-in user, or holding
 * a caller.
 */
export type ApiState = ApiLoadingState | ApiUnauthenticatedState | ApiReadyState

/**
 * What a call site asks of its API client.
 */
type ApiOptions = {
  /**
   * Whether the calls need a signed-in user. Without one the client reports itself unauthenticated and
   * hands out no caller; turned off, it stays ready and calls anonymously.
   */
  requireAuth?: boolean
}

/**
 * The API client for the current reader, minting a fresh Clerk token for every request it makes.
 *
 * @param options - What the call site asks of the client.
 *
 * @returns The client as it currently stands.
 */
export function useApi({ requireAuth = true }: ApiOptions = {}): ApiState {
  // Who is asking, and the token that proves it
  const { getToken, isLoaded, isSignedIn } = useAuth()

  // The reader's language, which the backend answers in
  const locale = useLocale()

  // The caller, rebuilt only when what it sends or who it sends it as moves underneath it
  const apiCall = useCallback(
    async <T>(endpoint: () => string, options: RequestInit = {}): Promise<ApiResult<T>> => {
      // Nobody to authenticate as, on a call that insists on one
      if (requireAuth && !isSignedIn) {
        return {
          success: false,
          error: {
            message: 'User is not signed in. Please authenticate first.',
            errorCode: 'Unauthenticated',
          },
        }
      }

      try {
        // The session token, which only a signed-in reader has one of
        const token: string | null = isSignedIn ? await getToken() : null

        // Signed in, yet Clerk minted nothing to send
        if (requireAuth && !token) {
          return {
            success: false,
            error: {
              message: 'Failed to retrieve authentication token.',
            },
          }
        }

        // What every call carries, with the call site's own headers on top
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept-Language': locale,
          ...options.headers,
        }

        // A token is what turns the call authenticated
        if (token) {
          ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
        }

        // The request itself
        const response = await fetch(endpoint(), {
          ...options,
          headers,
        })

        // The backend refused it
        if (!response.ok) {
          // Best-effort read of the problem body for the backend's machine-readable failure code
          const errorCode = await readErrorCode(response)

          // The refusal, carrying the status and whatever code came with it
          return {
            success: false,
            error: {
              message: `API request failed: ${response.statusText}`,
              statusCode: response.status,
              errorCode,
            },
          }
        }

        // A JSON body is the expected success shape
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          // The payload the endpoint answered with
          const data = await response.json()

          // The answer, as a success
          return { success: true, data }
        }

        // The body as text, since a bodyless 2xx (a 204, or a delete answering 200) is a legitimate
        // void success
        const body = await response.text()

        // An empty body is a success carrying nothing
        if (body.trim() === '') {
          return { success: true, data: {} as T }
        }

        // A 2xx carrying something that is not JSON: a captive portal or a proxy's HTML page, which
        // would land in the cache as an empty object if it were let through as a success
        return {
          success: false,
          error: {
            message: `Unexpected non-JSON response (${response.status})`,
            statusCode: response.status,
          },
        }
      } catch (error) {
        // The connection dropped, or the body would not parse
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'An unknown error occurred',
          },
        }
      }
    },
    [getToken, isSignedIn, requireAuth, locale]
  )

  // Still waiting on Clerk to say who is asking
  if (!isLoaded) {
    return { state: 'loading' }
  }

  // Needs a signed-in user and has none
  if (requireAuth && !isSignedIn) {
    return { state: 'unauthenticated' }
  }

  // Ready to issue requests, signed in or anonymously
  return {
    state: 'ready',
    apiCall,
  }
}

/**
 * The caller an API client hands out, which only a ready one has.
 *
 * @param api - The client as it currently stands.
 *
 * @returns The caller, or null while the client has none to give.
 */
export function apiCallOf(api: ApiState): ApiCaller | null {
  switch (api.state) {
    // The caller it was built with
    case 'ready':
      return api.apiCall

    // Still working out who is asking
    case 'loading':
      return null

    // Needs a signed-in user and has none
    case 'unauthenticated':
      return null

    // Every state is handled above
    default:
      return assertNever(api)
  }
}

/**
 * Narrows the API client to its request caller, throwing when the client isn't ready to issue requests.
 * A query's `enabled` flag gates on readiness before the fetch is scheduled, so this is the net for the
 * paths that skip that gate, and what lets the client narrow to a non-nullable {@link ApiCaller}.
 *
 * The failure it throws is coded, which is what stops it being retried and reported as a dropped
 * connection. The code says nobody is signed in, which is the state a reader can act on.
 *
 * @param api - The current API client state.
 *
 * @returns The caller for issuing requests.
 */
export function readyApiCall(api: ApiState): ApiCaller {
  // A ready client is required to issue a request
  if (api.state !== 'ready') {
    throw new BackendApiError({ message: 'API not ready', errorCode: 'Unauthenticated' })
  }

  // The ready client's caller
  return api.apiCall
}

/**
 * Binds an abort signal to a caller, so every request it makes is dropped when the signal fires.
 *
 * React Query treats a consumed signal as a promise to cancel, and on unmount rolls the fetch back
 * instead of keeping what came home, so a caller handed the signal has to honour it.
 *
 * @param apiCall - The caller to bind it to.
 * @param signal - What says the answer is no longer wanted.
 *
 * @returns A caller that abandons its requests when the signal fires.
 */
export function abortableCall(apiCall: ApiCaller, signal: AbortSignal): ApiCaller {
  // The same caller, with the signal riding on every request it makes
  return (endpoint, options) => apiCall(endpoint, { ...options, signal })
}
