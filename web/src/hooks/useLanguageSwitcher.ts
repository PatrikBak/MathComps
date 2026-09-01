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
 * Supports localized routes via {@link useLocalizedRoute} - when available, the slug and any
 * localized query tokens are re-expressed for the target locale on switch.
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

  // Get the page's localized-route context if it provides one (slug + query-token translators)
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
      // Start from the current route params
      const translatedParams = { ...params }
      // Translate the slug to the target locale when the route carries a string one
      if (params.slug && typeof params.slug === 'string') {
        translatedParams.slug = getTranslatedSlug(
          params.slug,
          newLocale,
          localizedRoute?.slugTranslations ?? null
        )
      }

      // Preserve the query, re-expressing it for the new locale when the route owns a translator
      // (the guide's deep-link tokens are localized); otherwise carry the params over verbatim
      const queryString = localizedRoute?.translateSearchParams
        ? localizedRoute.translateSearchParams(
            new URLSearchParams(searchParams.toString()),
            currentLocale,
            newLocale
          )
        : searchParams.toString()

      // Change it while preserving the current path, query parameters, and dynamic route params.
      // The query rides in its own field rather than glued onto the pathname: a pathname carrying one
      // matches no known route, so next-intl stops filling the route's dynamic segments in and the reader
      // lands on a literal '/mathildovanie/[slug]'
      router.replace(
        {
          pathname,
          // FROM INTL DOC:
          // @ts-expect-error -- TypeScript will validate that only known `params`
          // are used in combination with a given `pathname`. Since the two will
          // always match for the current route, we can skip runtime checks.
          params: translatedParams,
          query: Object.fromEntries(new URLSearchParams(queryString)),
        },
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
