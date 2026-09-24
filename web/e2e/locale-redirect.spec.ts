import type { HandoutIndex } from '@/components/features/handouts/handout-metadata-types'
import { supportsLocale } from '@/components/features/handouts/handout-metadata-types'
import handoutIndex from '@/content/handouts.json'

import { expect, test } from './support/test'

/** How long the page has to settle before a wait is called a failure. */
const SETTLE_TIMEOUT_MS = 15_000

/** A visit to a path with no locale prefix, and where the site sends it. */
type RedirectCase = {
  /** The path asked for. */
  path: string
  /** The browser's Accept-Language, or null for a browser that sends none. */
  acceptLanguage: string | null
  /** The path the redirect points at. */
  expected: string
}

/**
 * Where a visitor lands by the languages their browser asks for. A browser asking for no supported
 * language lands on English, and a supported one anywhere in its list still wins. A path with no prefix
 * is carried across, prefixed and translated into the visitor's locale.
 */
const REDIRECT_CASES: RedirectCase[] = [
  { path: '/', acceptLanguage: null, expected: '/en' },
  { path: '/', acceptLanguage: 'de-DE,de;q=0.9', expected: '/en' },
  { path: '/', acceptLanguage: 'ru-RU', expected: '/en' },
  { path: '/', acceptLanguage: 'kk-KZ', expected: '/en' },
  { path: '/', acceptLanguage: 'sk-SK,sk;q=0.9', expected: '/sk' },
  { path: '/', acceptLanguage: 'cs-CZ,cs;q=0.9', expected: '/cs' },
  { path: '/', acceptLanguage: 'en-US,en;q=0.9', expected: '/en' },
  { path: '/', acceptLanguage: 'ru-RU,sk;q=0.8', expected: '/sk' },
  { path: '/o-projekte', acceptLanguage: 'ru-RU', expected: '/en/about' },
  { path: '/about', acceptLanguage: 'sk-SK,sk;q=0.9', expected: '/sk/o-projekte' },
]

/** A handout worded differently in Slovak and English, which an old Slovak link has to be translated for. */
const handout = (handoutIndex as unknown as HandoutIndex).sections
  .flatMap((section) => section.handouts)
  .find(
    (candidate) =>
      supportsLocale(candidate, 'sk') &&
      supportsLocale(candidate, 'en') &&
      candidate.slug.sk !== candidate.slug.en
  )

test.describe('locale redirects', () => {
  // Plain requests open no page, so the backend guard has nothing to watch
  test.use({ hermeticBackend: async ({}, provide) => provide() })

  // One test per case
  for (const { path, acceptLanguage, expected } of REDIRECT_CASES) {
    test(`sends ${path} asked for in ${acceptLanguage ?? 'no language'} to ${expected}`, async ({
      request,
    }) => {
      // The path asked for with the browser's languages, the redirect left unfollowed
      const response = await request.get(path, {
        headers: acceptLanguage === null ? {} : { 'Accept-Language': acceptLanguage },
        maxRedirects: 0,
      })

      // A redirect
      expect(response.status()).toBe(307)

      // Where the redirect points, resolved against the path asked for
      const location = new URL(response.headers()['location'] ?? '', response.url())

      // The page the visitor's languages pick
      expect(location.pathname).toBe(expected)
    })
  }
})

test.describe('an old unprefixed handout link', () => {
  // A browser in a language the site has no version for
  test.use({ locale: 'ru-RU' })

  test('opens the handout in English', async ({ page }) => {
    // The content has to hold such a handout for there to be a link to follow
    if (handout === undefined) throw new Error('No handout is worded differently in sk and en')

    // The link as it read before the site had locale prefixes, which was Slovak
    await page.goto(`/materialy/${handout.slug.sk}`)

    // The English handout, under its own English slug
    await expect(page).toHaveURL(`/en/handouts/${handout.slug.en}`, { timeout: SETTLE_TIMEOUT_MS })
  })
})
