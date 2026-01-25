import { useParams, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'

import { type Locale } from '@/i18n/i18n'
import { usePathname, useRouter } from '@/i18n/navigation'

import { getTranslatedSlug, useLocalizedRoute } from './useLocalizedRoute'

/**
 * Return type for the {@link useLanguageSwitcher} hook.
 */
type LanguageSwitcherReturn = {
  /** The currently active locale */
  currentLocale: Locale
  /** Function to change the locale */
  changeLocale: (newLocale: Locale, onAfterChange?: () => void) => void
}

/**
 * Hook to handle language switching logic.
 * Encapsulates getting the current locale and changing it while preserving the current path.
 * Supports localized slugs via {@link useLocalizedRoute} - if available, slugs are translated
 * to the target locale when switching languages.
 */
export function useLanguageSwitcher(): LanguageSwitcherReturn {
  // Determine the currently active locale
  const currentLocale = useLocale() as Locale

  // Get the router that will be used to change the locale by changing the URL
  const router = useRouter()

  // Get the current pathname to preserve it when changing the locale
  const pathname = usePathname()

  // Get the current search params to preserve them when changing the locale
  const searchParams = useSearchParams()

  // Get the current route params (e.g., { slug: 'some-value' }) for dynamic routes
  const params = useParams()

  // Get slug translations if available (for content pages with localized slugs)
  const localizedRoute = useLocalizedRoute()

  /**
   * Function to change the locale.
   *
   * @param newLocale The new locale to switch to
   * @param onAfterChange Optional callback to be called after the locale has been changed
   */
  const changeLocale = (newLocale: Locale, onAfterChange?: () => void) => {
    // If the new locale is different from the current locale
    if (newLocale !== currentLocale) {
      // Build translated params - translate slug if we have translations
      const translatedParams = { ...params }
      if (params.slug && typeof params.slug === 'string') {
        translatedParams.slug = getTranslatedSlug(
          params.slug,
          newLocale,
          localizedRoute?.slugTranslations ?? null
        )
      }

      // Build the URL with query params preserved
      const queryString = searchParams.toString()
      const urlWithParams = queryString ? `${pathname}?${queryString}` : pathname

      // Change it while preserving the current path, query parameters, and dynamic route params
      router.replace(
        // FROM INTL DOC:
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname: urlWithParams, params: translatedParams },
        { locale: newLocale }
      )

      // Call the optional onAfterChange callback
      onAfterChange?.()
    }
  }

  // Return the current locale and the function to change it
  return {
    currentLocale,
    changeLocale,
  }
}
