import type { Locale } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'

import { generatePageMetadata } from '@/lib/metadata'

/**
 * Mock NEXT_PUBLIC_SITE_URL used in canonical URL and OG image generation.
 */
const TEST_SITE_URL = 'https://mathcomps.fun'

/**
 * Mock the env-utils module so getRequiredEnv always returns the test site URL.
 */
vi.mock('@/components/shared/utils/env-utils', () => ({
  getRequiredEnv: () => TEST_SITE_URL,
}))

describe('generatePageMetadata - canonical URL', () => {
  it('includes locale prefix for default locale (sk)', () => {
    // Generate metadata for the Slovak about page
    const metadata = generatePageMetadata({
      locale: 'sk',
      path: '/about',
      title: 'O projekte',
    })

    // Canonical should be the localized Slovak path with /sk/ prefix
    expect(metadata.alternates?.canonical).toBe(`${TEST_SITE_URL}/sk/o-projekte`)
  })

  it('includes locale prefix for English locale', () => {
    // Generate metadata for the English about page
    const metadata = generatePageMetadata({
      locale: 'en',
      path: '/about',
      title: 'About',
    })

    // Canonical should keep the English path with /en/ prefix
    expect(metadata.alternates?.canonical).toBe(`${TEST_SITE_URL}/en/about`)
  })

  it('includes locale prefix for Czech locale', () => {
    // Generate metadata for the Czech about page
    const metadata = generatePageMetadata({
      locale: 'cs',
      path: '/about',
      title: 'O projektu',
    })

    // Canonical should be the localized Czech path with /cs/ prefix
    expect(metadata.alternates?.canonical).toBe(`${TEST_SITE_URL}/cs/o-projektu`)
  })

  it('includes locale prefix without a trailing slash for the home page', () => {
    // Generate metadata for the Slovak home page
    const metadata = generatePageMetadata({
      locale: 'sk',
      path: '/',
    })

    // Canonical should be /sk (no trailing slash the server would 308 away)
    expect(metadata.alternates?.canonical).toBe(`${TEST_SITE_URL}/sk`)
  })

  it('resolves slugs in dynamic routes correctly', () => {
    // Generate metadata for a handout detail page with slug translations
    const metadata = generatePageMetadata({
      locale: 'sk',
      path: '/handouts/[slug]',
      title: 'Faktorizácia',
      slugTranslations: {
        sk: 'faktorizacia',
        en: 'factorization',
        cs: 'faktorizace',
      },
    })

    // Canonical should use the Slovak slug in the localized material path
    expect(metadata.alternates?.canonical).toBe(`${TEST_SITE_URL}/sk/materialy/faktorizacia`)
  })

  it('throws when slug translation is missing for the requested locale', () => {
    // Attempting to generate metadata for a slug route without the needed translation
    expect(() =>
      generatePageMetadata({
        locale: 'en',
        path: '/handouts/[slug]',
        title: 'Test',
        slugTranslations: { sk: 'test', cs: 'test' } as Record<Locale, string>,
      })
    ).toThrow('[Metadata]')
  })
})

describe('generatePageMetadata - hreflang alternates', () => {
  it('generates correct localized alternate URLs', () => {
    // Generate metadata for the about page
    const metadata = generatePageMetadata({
      locale: 'sk',
      path: '/about',
      title: 'O projekte',
    })

    // Extract alternate languages
    const languages = metadata.alternates?.languages as Record<string, string>

    // Each locale should get its own localized path
    expect(languages['sk']).toBe(`${TEST_SITE_URL}/sk/o-projekte`)
    expect(languages['en']).toBe(`${TEST_SITE_URL}/en/about`)
    expect(languages['cs']).toBe(`${TEST_SITE_URL}/cs/o-projektu`)

    // x-default should point to the default locale (sk)
    expect(languages['x-default']).toBe(languages['sk'])
  })

  it('generates correct slug-based alternate URLs', () => {
    // Generate metadata for a handout detail with slug translations
    const metadata = generatePageMetadata({
      locale: 'en',
      path: '/handouts/[slug]',
      title: 'Factorization',
      slugTranslations: {
        sk: 'faktorizacia',
        en: 'factorization',
        cs: 'faktorizace',
      },
    })

    // Extract alternate languages
    const languages = metadata.alternates?.languages as Record<string, string>

    // Each locale uses the localized handout path + localized slug
    expect(languages['sk']).toBe(`${TEST_SITE_URL}/sk/materialy/faktorizacia`)
    expect(languages['en']).toBe(`${TEST_SITE_URL}/en/handouts/factorization`)
    expect(languages['cs']).toBe(`${TEST_SITE_URL}/cs/materialy/faktorizace`)
  })

  it('emits trailing-slash-free home alternates with an x-default of the default locale', () => {
    // Generate metadata for the home page
    const metadata = generatePageMetadata({
      locale: 'sk',
      path: '/',
    })

    // Extract alternate languages
    const languages = metadata.alternates?.languages as Record<string, string>

    // Every home alternate should be the bare locale root, no trailing slash
    expect(languages['sk']).toBe(`${TEST_SITE_URL}/sk`)
    expect(languages['cs']).toBe(`${TEST_SITE_URL}/cs`)
    expect(languages['en']).toBe(`${TEST_SITE_URL}/en`)

    // x-default should point to the default locale (sk)
    expect(languages['x-default']).toBe(`${TEST_SITE_URL}/sk`)
  })

  it('falls back x-default to the only resolved locale for a single-language handout', () => {
    // Generate metadata for an English-only handout (no sk/cs slug)
    const metadata = generatePageMetadata({
      locale: 'en',
      path: '/handouts/[slug]',
      title: 'Adding Points',
      slugTranslations: { en: 'adding-points' } as Record<Locale, string>,
    })

    // Extract alternate languages
    const languages = metadata.alternates?.languages as Record<string, string>

    // Only the English alternate resolves; sk/cs are absent
    expect(languages['en']).toBe(`${TEST_SITE_URL}/en/handouts/adding-points`)
    expect(languages['sk']).toBeUndefined()
    expect(languages['cs']).toBeUndefined()

    // x-default falls back to the English URL rather than an undefined sk URL
    expect(languages['x-default']).toBe(`${TEST_SITE_URL}/en/handouts/adding-points`)
  })
})

describe('generatePageMetadata - dynamic route segments', () => {
  it('fills a route parameter into every locale of the path', () => {
    // A competition's own area, whose path is worded per locale and whose [slug] is not
    const metadata = generatePageMetadata({
      locale: 'sk',
      path: '/mathilding/[slug]',
      routeParams: { slug: 'open-intermediate' },
      title: 'Sutaz',
    })

    // The alternates the metadata carries
    const languages = metadata.alternates?.languages as Record<string, string>

    // One value substituted into each locale's own path, canonical and alternates alike
    expect(metadata.alternates?.canonical).toBe(
      `${TEST_SITE_URL}/sk/mathildovanie/open-intermediate`
    )
    expect(languages['en']).toBe(`${TEST_SITE_URL}/en/mathilding/open-intermediate`)
    expect(languages['cs']).toBe(`${TEST_SITE_URL}/cs/mathildovani/open-intermediate`)
  })

  it('refuses a path whose dynamic segment nobody supplied a value for', () => {
    // The same route with nothing to put in its [slug]
    expect(() =>
      generatePageMetadata({ locale: 'sk', path: '/mathilding/[slug]', title: 'Sutaz' })
    ).toThrow()
  })
})
