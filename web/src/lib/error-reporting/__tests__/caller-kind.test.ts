import { describe, expect, it } from 'vitest'

import { callerKindOf } from '../caller-kind'

/**
 * A visitor's Firefox.
 */
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0'

describe('callerKindOf', () => {
  it("reads a visitor's browser", () => {
    expect(callerKindOf(FIREFOX, false)).toBe('browser')
  })

  it('reads Googlebot as a crawler, though its agent opens like a browser', () => {
    // Googlebot's smartphone agent
    const googlebot =
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/153.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

    expect(callerKindOf(googlebot, false)).toBe('crawler')
  })

  it('reads a browser reporting a script at the wheel as a script, whatever its agent says', () => {
    expect(callerKindOf(FIREFOX, true)).toBe('script')
  })

  it('reads a headless browser as a script by its agent alone', () => {
    // Headless Chrome's agent
    const headless =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'HeadlessChrome/151.0.0.0 Safari/537.36'

    expect(callerKindOf(headless, false)).toBe('script')
  })

  it("reads Clerk's webhook sender as a webhook, not a script", () => {
    expect(
      callerKindOf('Svix-Webhooks/1.84.0 (sender-AbC12; +https://www.svix.com/http-sender/)', false)
    ).toBe('webhook')
  })

  it('reads a command-line tool and a missing agent as scripts', () => {
    expect(callerKindOf('curl/8.7.1', false)).toBe('script')
    expect(callerKindOf('', false)).toBe('script')
  })
})
