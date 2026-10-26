import { defineRouting } from 'next-intl/routing'

import { invert } from '@/components/shared/utils/collection-utils'

/** The locales the site is read in, as a tuple so {@link Locale} is their union. */
export const SUPPORTED_LOCALES = ['sk', 'cs', 'en'] as const

/** A locale the site is read in. */
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** A string value that exists in all supported locales. */
export type LocalizedString = Record<Locale, string>

/** A string value that may exist in only a subset of supported locales. */
export type PartialLocalizedString = Partial<Record<Locale, string>>

/** Primary locale of the application. */
export const DEFAULT_LOCALE = 'sk' as const satisfies Locale

/** Locale for a visitor whose browser languages include no supported one, or who sends none. */
export const UNMATCHED_VISITOR_LOCALE = 'en' as const satisfies Locale

/** Canonical locale whose paths match the folder names in app/[locale]/. */
const CANONICAL_LOCALE = 'en' as const satisfies Locale

/** Each locale's name, written in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  sk: 'Slovenčina',
  cs: 'Čeština',
  en: 'English',
}

/**
 * Builds the per-locale token → id reverse maps for a localized id → token table.
 *
 * @param byLocale - The id → token table for each locale.
 *
 * @returns The token → id lookup per locale.
 */
export function invertByLocale<TId extends string>(
  byLocale: Record<Locale, Record<TId, string>>
): Record<Locale, Map<string, TId>> {
  // Invert each locale's table
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, invert(byLocale[locale])])
  ) as Record<Locale, Map<string, TId>>
}

/**
 * Locales as their codes, upper-cased, in a list.
 *
 * @param locales - The locales.
 *
 * @returns The list, like `EN, SK`.
 */
export function localeCodeList(locales: readonly Locale[]): string {
  // Every code in capitals, separated by commas
  return locales.map((locale) => locale.toUpperCase()).join(', ')
}

/**
 * The site's routes, each as its path in the canonical locale.
 */
export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  GUIDE: '/guide',
  HANDOUTS: '/handouts',
  HANDOUT_DETAIL: '/handouts/[slug]',
  PROBLEMS: '/problems',
  COMPETITIONS: '/mathilding',
  COMPETITION_AREA: '/mathilding/[slug]',
  LOGIN: '/sign-in',
  PROFILE: '/profile',
  SSO_CALLBACK: '/sso-callback',
  PRIVACY: '/privacy',
  NEWS: '/news',
  ADMIN_DEFENSES: '/admin/defenses',
  ADMIN_GRADING: '/admin/grading/[slug]',
  ORGANIZATION_SELECTION: '/problem-selection/[slug]',
} as const

/** A route, as its path in the canonical locale. */
type RouteKey = (typeof ROUTES)[keyof typeof ROUTES]

/** Localized value for every non-canonical locale. */
type NonCanonicalLocaleTranslations = Record<Exclude<Locale, typeof CANONICAL_LOCALE>, string>

/**
 * Each route's path in every non-canonical locale, keyed by its path in the canonical locale.
 */
const ROUTE_TRANSLATIONS: Record<RouteKey, NonCanonicalLocaleTranslations> = {
  '/': { sk: '/', cs: '/' },
  '/about': { sk: '/o-projekte', cs: '/o-projektu' },
  '/guide': { sk: '/sprievodca', cs: '/rozcestnik' },
  '/handouts': { sk: '/materialy', cs: '/materialy' },
  '/handouts/[slug]': { sk: '/materialy/[slug]', cs: '/materialy/[slug]' },
  '/problems': { sk: '/ulohy', cs: '/ulohy' },
  '/mathilding': { sk: '/mathildovanie', cs: '/mathildovani' },
  '/mathilding/[slug]': { sk: '/mathildovanie/[slug]', cs: '/mathildovani/[slug]' },
  '/sign-in': { sk: '/prihlasit-sa', cs: '/prihlasit-se' },
  '/profile': { sk: '/profil', cs: '/profil' },
  '/sso-callback': { sk: '/sso-callback', cs: '/sso-callback' },
  '/privacy': { sk: '/ochrana-sukromia', cs: '/ochrana-soukromi' },
  '/news': { sk: '/novinky', cs: '/novinky' },
  '/admin/defenses': { sk: '/admin/obhajoby', cs: '/admin/obhajoby' },
  '/admin/grading/[slug]': { sk: '/admin/hodnotenie/[slug]', cs: '/admin/hodnoceni/[slug]' },
  '/problem-selection/[slug]': { sk: '/vyber-uloh/[slug]', cs: '/vyber-uloh/[slug]' },
}

/** The site's in-page anchors, each as its fragment in the canonical locale. */
export const ANCHORS = {
  COMMENTS: 'comments',
  ABOUT_AUTHOR: 'aboutAuthor',
} as const

/** An in-page anchor, as its fragment in the canonical locale. */
type AnchorKey = (typeof ANCHORS)[keyof typeof ANCHORS]

/** Localized anchors for the non-canonical locales. */
const ANCHOR_TRANSLATIONS: Record<AnchorKey, NonCanonicalLocaleTranslations> = {
  comments: { sk: 'komentare', cs: 'komentare' },
  aboutAuthor: { sk: 'oAutorovi', cs: 'oAutorovi' },
}

/**
 * A locale's URL fragment for an in-page anchor, the canonical locale using the anchor as it is.
 *
 * @param anchor - The anchor to localize.
 * @param locale - The target locale.
 *
 * @returns The fragment in that locale.
 */
export function getLocalizedAnchor(anchor: AnchorKey, locale: Locale): string {
  // The canonical locale uses the anchor as it is
  if (locale === CANONICAL_LOCALE) return anchor

  // Every other locale uses its translated anchor
  return ANCHOR_TRANSLATIONS[anchor][locale]
}

/**
 * Builds the pathnames map out of {@link ROUTES} and {@link ROUTE_TRANSLATIONS}: each route's path in every locale,
 * or the bare route where no locale changes it.
 *
 * @returns The pathnames map keyed by canonical route.
 */
function buildPathnames(): Record<string, string | Record<Locale, string>> {
  // Pair every route with its localized variants
  return Object.fromEntries(
    Object.values(ROUTES).map((route) => {
      // Localized paths for this route in the non-canonical locales
      const translations = ROUTE_TRANSLATIONS[route]

      // Does every locale keep the canonical path?
      const allSame = Object.values(translations).every((path) => path === route)

      // Collapse to a single shared path when nothing is localized
      if (allSame) return [route, route]

      // Otherwise spell out the per-locale map, the canonical locale taking the route itself
      return [route, { [CANONICAL_LOCALE]: route, ...translations }]
    })
  )
}

/** Each localized route's path per locale, keyed by its canonical path. */
export const pathnames = buildPathnames()

/** Locale prefix strategy for URLs. Always show the locale prefix. */
export const localePrefix = 'always'

/** Next-intl routing configuration. */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix,
  pathnames,
})
