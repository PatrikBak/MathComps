import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchApiResult } from '../api-fetch'

/**
 * Parks a response for the next call to answer with.
 *
 * @param body - The body it carries.
 * @param init - Its status and headers.
 */
function answerWith(body: string, init: ResponseInit) {
  // The one response every call gets until the next test parks its own
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, init))
  )
}

/** The headers a JSON answer comes with. */
const JSON_HEADERS = { 'Content-Type': 'application/json' }

afterEach(() => {
  // Hand the real fetch back, so a test that parks nothing cannot inherit the last one's answer
  vi.unstubAllGlobals()
})

describe('fetchApiResult', () => {
  it('carries the status of a refusal', async () => {
    // A refusal the server sent no code with
    answerWith('{}', { status: 503, statusText: 'Service Unavailable', headers: JSON_HEADERS })

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // The status is what says whether asking again could go differently, so it has to survive the call
    expect(result).toEqual({
      success: false,
      error: {
        message: 'API request failed: Service Unavailable',
        statusCode: 503,
        errorCode: undefined,
      },
    })
  })

  it('reads the failure code off the refusal body', async () => {
    // A route naming what it refused on
    answerWith(JSON.stringify({ errorCode: 'FILE_TOO_LARGE' }), {
      status: 400,
      statusText: 'Bad Request',
      headers: JSON_HEADERS,
    })

    // The call, settled
    const result = await fetchApiResult('/api/files/upload-url')

    // The code is what picks the copy the reader is shown
    expect(result.success).toBe(false)
    expect(result.success === false && result.error.errorCode).toBe('FILE_TOO_LARGE')
  })

  it('drops a code it does not recognize', async () => {
    // A body naming something the frontend has no copy for
    answerWith(JSON.stringify({ errorCode: 'WHAT_IS_THIS' }), {
      status: 400,
      statusText: 'Bad Request',
      headers: JSON_HEADERS,
    })

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // An unknown code resolves to nothing, which is what sends the caller to its own fallback copy
    expect(result.success === false && result.error.errorCode).toBeUndefined()
  })

  it('answers a JSON body as the call data', async () => {
    // The payload an endpoint answered with
    answerWith(JSON.stringify({ key: 'files/abc.png' }), { status: 200, headers: JSON_HEADERS })

    // The call, settled
    const result = await fetchApiResult<{ key: string }>('/api/files/upload-url')

    // The parsed body is the success
    expect(result).toEqual({ success: true, data: { key: 'files/abc.png' } })
  })

  it('answers an empty body as a success carrying nothing', async () => {
    // A delete, which has nothing to say beyond having worked
    answerWith('', { status: 200 })

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // A bodyless 2xx is a legitimate void success
    expect(result).toEqual({ success: true, data: {} })
  })

  it('refuses a 2xx carrying something that is not JSON', async () => {
    // A captive portal or a proxy answering the request with its own page
    answerWith('<html>Sign in to this network</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // Letting this through as a success would land an empty object in the cache
    expect(result).toEqual({
      success: false,
      error: { message: 'Unexpected non-JSON response (200)', statusCode: 200 },
    })
  })

  it('settles a dropped connection instead of rejecting', async () => {
    // The fetch itself failing, which is what being offline looks like
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      })
    )

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // No status, since nothing reached a server, and no code, since the client had no name for it
    expect(result).toEqual({ success: false, error: { message: 'Failed to fetch' } })
  })

  it('settles a body that will not parse instead of rejecting', async () => {
    // A response claiming JSON and carrying something else
    answerWith('not json at all', { status: 200, headers: JSON_HEADERS })

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // The parse throw is caught like any other failure, so the caller never needs a try/catch
    expect(result.success).toBe(false)
  })

  it("sends the JSON content type alongside the call site's own headers", async () => {
    // A call that answers whatever it is asked
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: JSON_HEADERS }))
    vi.stubGlobal('fetch', fetchMock)

    // A call site adding the headers only it knows about, which is how the token and the reader's
    // language reach a backend call
    await fetchApiResult('/api/anything', {
      method: 'POST',
      headers: { 'Accept-Language': 'sk' },
    })

    // Both ride on the request
    expect(fetchMock).toHaveBeenCalledWith('/api/anything', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'sk' },
    })
  })
})
