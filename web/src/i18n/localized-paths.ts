import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import type { Locale, PartialLocalizedString } from '@/i18n/i18n'
import { DEFAULT_LOCALE, pathnames, SUPPORTED_LOCALES } from '@/i18n/i18n'

/**
 * Resolves the localized path for a given canonical path and locale.
 * Looks up the path in the next-intl pathnames map and substitutes any [slug] placeholder.
 *
 * @param canonicalPath - The canonical (English) route path (e.g., '/about')
 * @param locale - The target locale
 * @param slugTranslations - Optional map of localized slugs to replace [slug] with
 *
 * @returns The resolved localized path, or undefined if the locale has no slug translation
 */
export function resolveLocalizedPath(
  canonicalPath: string,
  locale: Locale,
  slugTranslations?: PartialLocalizedString
): string | undefined {
  // Get the pathname mapping for this route (if it exists)
  const pathnameMapping = pathnames[canonicalPath]

  // Determine the localized path based on the mapping type
  let localizedPath: string

  // Simple path - same for all locales
  if (typeof pathnameMapping === 'string') {
    localizedPath = pathnameMapping
  }
  // Localized path - get the locale-specific version
  else if (pathnameMapping && typeof pathnameMapping === 'object') {
    localizedPath = pathnameMapping[locale] ?? canonicalPath
  }
  // Not in pathnames map - use canonical path as-is
  else {
    localizedPath = canonicalPath
  }

  // Replace [slug] with actual slug if present
  if (localizedPath.includes('[slug]')) {
    // Use translation if available
    const slug = slugTranslations?.[locale]
    if (slug) {
      localizedPath = localizedPath.replace('[slug]', slug)
    } else {
      // No slug for this locale - cannot resolve the path
      return undefined
    }
  }

  // Return the resolved localized path
  return localizedPath
}

/**
 * Turns a resolved localized path into the URL suffix after the locale prefix.
 * Collapses the home root so the locale URL carries no trailing slash (`/sk`, not `/sk/`),
 * which the server would otherwise 308-redirect away.
 *
 * @param localizedPath - The resolved localized path (e.g. '/o-projekte' or '/').
 *
 * @returns The suffix to append after `/{locale}`.
 */
export function toLocaleUrlSuffix(localizedPath: string): string {
  // Home root becomes empty; every other path is used as-is
  return localizedPath === '/' ? '' : localizedPath
}

/**
 * Builds the alternate language URLs for hreflang tags.
 * Dynamically generates URLs for all supported locales plus x-default.
 * Replaces [slug] placeholder with actual localized slug if translations are provided.
 *
 * @param canonicalPath - The canonical path for the route (e.g., '/problems')
 * @param slugTranslations - Optional map of localized slugs to replace [slug] with
 *
 * @returns An object mapping locale codes to full URLs for alternates.languages
 */
export function buildAlternateLanguages(
  canonicalPath: string,
  slugTranslations?: PartialLocalizedString
): Record<string, string> {
  // We need to include real site url
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')

  // The result will be here
  const languages: Record<string, string> = {}

  // Handle all supported locales
  for (const locale of SUPPORTED_LOCALES) {
    // Resolve the localized path for this locale
    const localizedPath = resolveLocalizedPath(canonicalPath, locale, slugTranslations)

    // Skip locales where the path couldn't be resolved (e.g. missing slug)
    if (localizedPath === undefined) continue

    // Build full URL with locale prefix
    languages[locale] = `${siteUrl}/${locale}${toLocaleUrlSuffix(localizedPath)}`
  }

  // Collect the URLs that actually resolved
  const resolvedUrls = Object.values(languages)

  // Point x-default at the default locale, falling back to the first resolved alternate
  if (resolvedUrls.length > 0) {
    languages['x-default'] = languages[DEFAULT_LOCALE] ?? resolvedUrls[0]
  }

  // Return the built map
  return languages
}
