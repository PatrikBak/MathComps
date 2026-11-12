import type { HandoutIndex } from '@/components/features/handouts/handout-metadata-types'
import { supportsLocale } from '@/components/features/handouts/handout-metadata-types'
import { RETURN_URL_PARAM } from '@/constants/auth-constants'
import handoutIndex from '@/content/handouts.json'

import { addressParams } from './support/address'
import { headerSignInLink } from './support/interaction'
import { expect, SETTLE_TIMEOUT_MS, test } from './support/test'

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

test.describe('a Slovak sign-in link', () => {
  test('opens the Slovak login page with no redirect on the way', async ({ page }) => {
    // Every request for the login page under its English path, each answered with a redirect
    const englishPathRequests: string[] = []

    // Watched from before the page loads, so a prefetch is caught too
    page.on('request', (request) => {
      // Kept when it asks for the English path under the Slovak prefix
      if (new URL(request.url()).pathname === '/sk/sign-in') englishPathRequests.push(request.url())
    })

    // The Slovak about page
    await page.goto('/sk/o-projekte')

    // The header's link names the Slovak login page, which is what a new tab opens
    await expect(headerSignInLink(page, 'sk')).toHaveAttribute('href', /^\/sk\/prihlasit-sa\?/, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    // Sign in from the header
    await headerSignInLink(page, 'sk').click()

    // The Slovak login page
    await expect(page).toHaveURL(/\/sk\/prihlasit-sa\?/, { timeout: SETTLE_TIMEOUT_MS })

    // Coming back to the about page
    expect(addressParams(page).get(RETURN_URL_PARAM)).toBe('/sk/o-projekte')

    // Reached without ever asking for the English path
    expect(englishPathRequests).toEqual([])
  })
})
