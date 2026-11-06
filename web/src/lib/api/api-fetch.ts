import { readErrorCode } from '@/lib/api/api-error-codes'
import {
  reportForeignRefusal,
  reportUnansweredRequest,
} from '@/lib/error-reporting/report-request-failure'
import type { ApiResult } from '@/types/api'

/**
 * Issues a request and settles it into an {@link ApiResult}. It owns the total error catch: every
 * failure (a non-OK response, a fetch or parse throw) comes back as a failure result carrying the HTTP
 * status and whatever machine-readable code the body held. It never rejects, so a caller branches on
 * `success` (or hands the result to `unwrap`), never a try/catch.
 *
 * Failures no server of ours records also reach error tracking. A request that gets no answer at
 * all goes to {@link reportUnansweredRequest}, unless its caller cancelled it. Every refusal goes to
 * {@link reportForeignRefusal}, which files only those from a server that isn't ours.
 *
 * This is the one place a response becomes a result, whichever server answers. Who is asking is the
 * caller's business, carried in as headers.
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
    // A JSON body unless the call site says otherwise, its own headers going on top
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // The request itself
    const response = await fetch(url, {
      ...options,
      headers,
    }).catch((error: unknown) => {
      // A request that got no answer is reported, unless its caller cancelled it
      if (!options.signal?.aborted) {
        reportUnansweredRequest(url, error)
      }

      // The failure still settles like any other
      throw error
    })

    // The server refused it
    if (!response.ok) {
      // Hand the refusal to its reporter, which files only a foreign server's
      reportForeignRefusal(url, response.status)

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
    // The request got no answer, or its body would not parse
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      },
    }
  }
}
