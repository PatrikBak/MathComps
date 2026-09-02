import { readErrorCode } from '@/lib/api/api-error-codes'
import type { ApiResult } from '@/types/api'

/**
 * Issues a request and settles it into an {@link ApiResult}. It owns the total error catch: every
 * failure (a non-OK response, a fetch or parse throw) comes back as a failure result carrying the HTTP
 * status and whatever machine-readable code the body held. It never rejects, so a caller branches on
 * `success` (or hands the result to `unwrap`), never a try/catch.
 *
 * This is the one place a response becomes a result, for the C# backend and the app's own Next.js
 * routes alike. Who is asking is the caller's business, carried in as headers.
 *
 * @template T - What the endpoint answers with.
 *
 * @param url - The URL to call.
 * @param options - The method, body and headers to send.
 *
 * @returns The settled result of the call.
 */
export async function fetchApiResult<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  // Everything from here to the answer, since a failure at any step of it settles the same way
  try {
    // A JSON body is what every endpoint here speaks, with the call site's own headers on top
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // The request itself
    const response = await fetch(url, {
      ...options,
      headers,
    })

    // The server refused it
    if (!response.ok) {
      // Best-effort read of the problem body for the machine-readable failure code
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

    // The body as text, since a bodyless 2xx (a 204, or a delete answering 200) is a legitimate void
    // success
    const body = await response.text()

    // An empty body is a success carrying nothing
    if (body.trim() === '') {
      return { success: true, data: {} as T }
    }

    // A 2xx carrying something that is not JSON: a captive portal or a proxy's HTML page, which would
    // land in the cache as an empty object if it were let through as a success
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
}
