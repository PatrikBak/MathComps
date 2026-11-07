import { afterEach, describe, expect, it, vi } from 'vitest'

import { reportUnansweredRequest } from '@/lib/error-reporting/report-request-failure'

import { fetchApiResult } from '../api-fetch'

/**
 * Stand in for the reporter, so a test can read which failures reached it.
 */
vi.mock('@/lib/error-reporting/report-request-failure', () => ({
  reportUnansweredRequest: vi.fn(),
}))

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

/**
 * Parks a failure for the next call to fail with.
 *
 * @param error - What the call fails with.
 */
function failWith(error: unknown) {
  // The one failure every call gets until the next test parks its own
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw error
    })
  )
}

/** The headers a JSON answer comes with. */
const JSON_HEADERS = { 'Content-Type': 'application/json' }

afterEach(() => {
  // Hand the real fetch back, so a test that parks nothing cannot inherit the last one's answer
  vi.unstubAllGlobals()

  // Forget the failures reported so far
  vi.mocked(reportUnansweredRequest).mockClear()
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
    answerWith(JSON.stringify({ errorCode: 'VALIDATION_FAILED' }), {
      status: 400,
      statusText: 'Bad Request',
      headers: JSON_HEADERS,
    })

    // The call, settled
    const result = await fetchApiResult('/api/contact')

    // The code is what picks the copy the reader is shown
    expect(result.success).toBe(false)
    expect(result.success === false && result.error.errorCode).toBe('VALIDATION_FAILED')
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
    const result = await fetchApiResult<{ key: string }>('https://api.example.test/files')

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
    failWith(new TypeError('Failed to fetch'))

    // The call, settled
    const result = await fetchApiResult('/api/anything')

    // No status, since nothing reached a server, and no code, since the client had no name for it
    expect(result).toEqual({ success: false, error: { message: 'Failed to fetch' } })
  })

  it('never reports a request that got an answer as unanswered', async () => {
    // A refusal, which a server sent
    answerWith('{}', { status: 500, statusText: 'Internal Server Error', headers: JSON_HEADERS })

    // Its call, settled
    await fetchApiResult('/api/anything')

    // A body that will not parse, which a server still sent
    answerWith('not json at all', { status: 200, headers: JSON_HEADERS })

    // Its call, settled
    await fetchApiResult('/api/anything')

    // Neither request went unanswered
    expect(reportUnansweredRequest).not.toHaveBeenCalled()
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

  it('reports a request that got no answer', async () => {
    // What a request that got no answer fails with
    const failure = new TypeError('Failed to fetch')

    // The fetch itself failing with it
    failWith(failure)

    // The call, settled
    await fetchApiResult('/api/anything')

    // No server of ours saw the request, so the browser reports it, naming where it went
    expect(reportUnansweredRequest).toHaveBeenCalledWith('/api/anything', failure)
  })

  it('leaves a request its caller cancelled unreported', async () => {
    // A caller that has cancelled its request
    const controller = new AbortController()
    controller.abort()

    // The fetch failing the way a cancelled one does
    failWith(new DOMException('The operation was aborted.', 'AbortError'))

    // The call, settled
    const result = await fetchApiResult('/api/anything', { signal: controller.signal })

    // A cancelled request still settles as a failure
    expect(result.success).toBe(false)

    // Yet a cancellation is nothing to report
    expect(reportUnansweredRequest).not.toHaveBeenCalled()
  })
})
