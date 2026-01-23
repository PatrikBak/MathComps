import { defineRouting } from 'next-intl/routing'

import type { Country } from '@/components/features/guide/layout/FlagIcon'

/** Supported locales as a tuple for type inference. */
export const SUPPORTED_LOCALES = ['sk', 'cs', 'en'] as const

/** Union type of all supported locale codes. */
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** A string value that exists in all supported locales. */
export type LocalizedString = Record<Locale, string>

/** Default (fallback) locale for the application. Users are redirected here when visiting '/'. */
export const DEFAULT_LOCALE = 'sk' as const satisfies Locale

/** Canonical locale whose paths match the folder names in app/[locale]/. */
const CANONICAL_LOCALE = 'en' as const satisfies Locale

/** Human-readable display names for each locale. */
export const LOCALE_NAMES: Record<Locale, string> = {
  sk: 'Slovenčina',
  cs: 'Čeština',
  en: 'English',
}

/** Maps locale to flag country code. */
export const LOCALE_TO_COUNTRY: Record<Locale, Country> = {
  sk: 'SK',
  cs: 'CZ',
  en: 'EN',
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
  LOGIN: '/sign-in',
  PROFILE: '/profile',
  SSO_CALLBACK: '/sso-callback',
  PRIVACY: '/privacy',
  NEWS: '/news',
  NEWS_DETAIL: '/news/[slug]',
} as const

/** Union type of all possible route paths. */
type RouteKey = (typeof ROUTES)[keyof typeof ROUTES]

/** Type for translations to non-canonical locales. */
type NonCanonicalLocaleTranslations = Record<Exclude<Locale, typeof CANONICAL_LOCALE>, string>

/**
 * Route translations for Slovak locale.
 * English is canonical; Slovak paths are listed here.
 */
const ROUTE_TRANSLATIONS: Record<RouteKey, NonCanonicalLocaleTranslations> = {
  '/': { sk: '/', cs: '/' },
  '/about': { sk: '/o-projekte', cs: '/o-projektu' },
  '/guide': { sk: '/rozcestnik', cs: '/rozcestnik' },
  '/handouts': { sk: '/materialy', cs: '/materialy' },
  '/handouts/[slug]': { sk: '/materialy/[slug]', cs: '/materialy/[slug]' },
  '/problems': { sk: '/ulohy', cs: '/ulohy' },
  '/sign-in': { sk: '/prihlasit-sa', cs: '/prihlasit-se' },
  '/profile': { sk: '/profil', cs: '/profil' },
  '/sso-callback': { sk: '/sso-callback', cs: '/sso-callback' },
  '/privacy': { sk: '/ochrana-sukromia', cs: '/ochrana-soukromi' },
  '/news': { sk: '/novinky', cs: '/novinky' },
  '/news/[slug]': { sk: '/novinky/[slug]', cs: '/novinky/[slug]' },
}

/** Common anchor fragments used for in-page navigation. English is canonical. */
export const ANCHORS = {
  COMMENTS: 'comments',
  ABOUT_AUTHOR: 'aboutAuthor',
} as const

/** Union type of all anchor keys. */
type AnchorKey = (typeof ANCHORS)[keyof typeof ANCHORS]

/**
 * Translations for anchors to non-canonical (Slovak) locale.
 */
const ANCHOR_TRANSLATIONS: Record<AnchorKey, NonCanonicalLocaleTranslations> = {
  comments: { sk: 'komentare', cs: 'komentare' },
  aboutAuthor: { sk: 'oAutorovi', cs: 'oAutorovi' },
}

/**
 * Returns the localized anchor for the given locale.
 *
 * @param anchor - The anchor key to localize.
 * @param locale - The target locale.
 *
 * @returns The localized anchor for the given locale.
 */
export function getLocalizedAnchor(anchor: AnchorKey, locale: Locale): string {
  // Handle canonical locale (English)
  if (locale === CANONICAL_LOCALE) return anchor

  // Handle non-canonical locales (Slovak)
  return ANCHOR_TRANSLATIONS[anchor][locale]
}

/**
 * Builds the pathnames map for next-intl from routes and translations.
 * Maps each route to its localized variants.
 *
 * English is canonical; Slovak paths come from ROUTE_TRANSLATIONS.
 *
 * @returns The pathnames map for next-intl.
 */
function buildPathnames(): Record<string, string | Record<Locale, string>> {
  const pathnames: Record<string, string | Record<Locale, string>> = {}

  for (const route of Object.values(ROUTES)) {
    const translations = ROUTE_TRANSLATIONS[route]

    // Check if all translations match the canonical route
    const allSame = Object.values(translations).every((path) => path === route)

    if (allSame) {
      pathnames[route] = route
    } else {
      // Build full locale map
      pathnames[route] = {
        [CANONICAL_LOCALE]: route,
        ...translations,
      }
    }
  }

  return pathnames
}

/** Pathname mappings for next-intl. */
export const pathnames = buildPathnames()

/** Locale prefix strategy for URLs. Always show /sk/ or /en/ prefix. */
export const localePrefix = 'always'

/** Next-intl routing configuration. */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix,
  pathnames,
})
