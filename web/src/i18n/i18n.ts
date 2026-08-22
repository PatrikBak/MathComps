import { defineRouting } from 'next-intl/routing'

import type { Country } from '@/components/features/guide/content/guide-content-types'
import { invert } from '@/components/shared/utils/collection-utils'

/** Supported locales as a tuple for type inference. */
export const SUPPORTED_LOCALES = ['sk', 'cs', 'en'] as const

/** Union type of all supported locale codes. */
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** A string value that exists in all supported locales. */
export type LocalizedString = Record<Locale, string>

/** A string value that may exist in only a subset of supported locales. */
export type PartialLocalizedString = Partial<Record<Locale, string>>

/** Default (fallback) locale for the application. */
export const DEFAULT_LOCALE = 'sk' as const satisfies Locale

/** Canonical locale whose paths match the folder names in app/[locale]/. */
const CANONICAL_LOCALE = 'en' as const satisfies Locale

/** Human-readable display names for each locale. */
export const LOCALE_NAMES: Record<Locale, string> = {
  sk: 'Slovenčina',
  cs: 'Čeština',
  en: 'English',
}

/** Maps each locale to its country code. */
export const LOCALE_TO_COUNTRY: Record<Locale, Country> = {
  sk: 'SK',
  cs: 'CZ',
  en: 'EN',
}

/**
 * Builds the per-locale value → id reverse maps for a localized id → token table.
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
 * Centralized route constants for the application.
 * English paths are canonical (matching folder names in app/[locale]/).
 */
export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  GUIDE: '/guide',
  HANDOUTS: '/handouts',
  HANDOUT_DETAIL: '/handouts/[slug]',
  PROBLEMS: '/problems',
  COMPETITIONS: '/competitions',
  LOGIN: '/sign-in',
  PROFILE: '/profile',
  SSO_CALLBACK: '/sso-callback',
  PRIVACY: '/privacy',
  NEWS: '/news',
  ADMIN_DEFENSES: '/admin/defenses',
} as const

/** Union type of all possible route paths. */
type RouteKey = (typeof ROUTES)[keyof typeof ROUTES]

/** Localized value for every non-canonical locale. */
type NonCanonicalLocaleTranslations = Record<Exclude<Locale, typeof CANONICAL_LOCALE>, string>

/**
 * Localized route paths for the non-canonical locales.
 * English is canonical, so each route's own value is the English path.
 */
const ROUTE_TRANSLATIONS: Record<RouteKey, NonCanonicalLocaleTranslations> = {
  '/': { sk: '/', cs: '/' },
  '/about': { sk: '/o-projekte', cs: '/o-projektu' },
  '/guide': { sk: '/sprievodca', cs: '/rozcestnik' },
  '/handouts': { sk: '/materialy', cs: '/materialy' },
  '/handouts/[slug]': { sk: '/materialy/[slug]', cs: '/materialy/[slug]' },
  '/problems': { sk: '/ulohy', cs: '/ulohy' },
  '/competitions': { sk: '/sutaze', cs: '/souteze' },
  '/sign-in': { sk: '/prihlasit-sa', cs: '/prihlasit-se' },
  '/profile': { sk: '/profil', cs: '/profil' },
  '/sso-callback': { sk: '/sso-callback', cs: '/sso-callback' },
  '/privacy': { sk: '/ochrana-sukromia', cs: '/ochrana-soukromi' },
  '/news': { sk: '/novinky', cs: '/novinky' },
  '/admin/defenses': { sk: '/admin/obhajoby', cs: '/admin/obhajoby' },
}

/** Common anchor fragments used for in-page navigation. English is canonical. */
export const ANCHORS = {
  COMMENTS: 'comments',
  ABOUT_AUTHOR: 'aboutAuthor',
} as const

/** Union type of all anchor keys. */
type AnchorKey = (typeof ANCHORS)[keyof typeof ANCHORS]

/** Localized anchors for the non-canonical locales. */
const ANCHOR_TRANSLATIONS: Record<AnchorKey, NonCanonicalLocaleTranslations> = {
  comments: { sk: 'komentare', cs: 'komentare' },
  aboutAuthor: { sk: 'oAutorovi', cs: 'oAutorovi' },
}

/**
 * A locale's path fragment for an in-page anchor; the canonical locale uses the anchor key verbatim.
 *
 * @param anchor - The anchor key to localize.
 * @param locale - The target locale.
 *
 * @returns The anchor fragment for that locale (the bare key for the canonical locale).
 */
export function getLocalizedAnchor(anchor: AnchorKey, locale: Locale): string {
  // Canonical locale uses the anchor key as-is
  if (locale === CANONICAL_LOCALE) return anchor

  // Every other locale uses its translated anchor
  return ANCHOR_TRANSLATIONS[anchor][locale]
}

/**
 * Builds the pathnames map from the routes and their localized paths.
 * English is canonical; non-canonical paths come from {@link ROUTE_TRANSLATIONS}.
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

      // Otherwise spell out the per-locale map, English keyed by the canonical path
      return [route, { [CANONICAL_LOCALE]: route, ...translations }]
    })
  )
}

/** Pathname mappings for next-intl. */
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
