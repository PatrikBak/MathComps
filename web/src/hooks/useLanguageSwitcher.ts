import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

import { type Locale, localeCookie, translateFragment } from '@/i18n/i18n'
import { getPathname, usePathname } from '@/i18n/navigation'

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
 * Encapsulates getting the current locale and changing it while keeping the reader on the same page,
 * query and fragment. Supports localized routes via {@link useLocalizedRoute}: when available, the
 * slug, any localized query tokens and the route's own anchors are re-expressed for the target locale.
 */
export function useLanguageSwitcher(): LanguageSwitcherReturn {
  // Determine the currently active locale
  const currentLocale = useLocale() as Locale

  // Get the router that will be used to change the locale by changing the URL
  const router = useRouter()

  // Get the current pathname to preserve it when changing the locale
  const pathname = usePathname()

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
      // The new locale remembered for addresses with no prefix. The middleware sets it too, but only
      // on a request reaching the server, and a page read in that locale a moment ago can be served
      // from Next's router cache without one
      document.cookie = `${localeCookie.name}=${newLocale}; path=/; samesite=${localeCookie.sameSite}`

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

      // The current path and dynamic route params, spelled in the new locale
      const localizedPath = getPathname({
        href: {
          pathname,
          // FROM INTL DOC:
          // @ts-expect-error -- TypeScript will validate that only known `params`
          // are used in combination with a given `pathname`. Since the two will
          // always match for the current route, we can skip runtime checks.
          params: translatedParams,
        },
        locale: newLocale,
      })

      // The query on the address bar right now. Read at click time: reading it during render
      // (useSearchParams) leaves every prerendered page to be rendered in the browser
      const searchParams = new URLSearchParams(window.location.search)

      // Preserve the query, re-expressing it for the new locale when the route owns a translator
      // (the guide's deep-link tokens are localized); otherwise carry the params over verbatim
      const queryString = localizedRoute?.translateSearchParams
        ? localizedRoute.translateSearchParams(searchParams, currentLocale, newLocale)
        : searchParams.toString()

      // The fragment on the address bar right now, re-spelled for the new locale
      const fragment = translateFragment(
        window.location.hash.slice(1),
        currentLocale,
        newLocale,
        localizedRoute?.anchorTranslations
      )

      // The query and the fragment, each led by the `?` or `#` that opens it
      const search = queryString === '' ? '' : `?${queryString}`
      const hash = fragment === '' ? '' : `#${fragment}`

      // Go there through Next's own router, since next-intl's carries no fragment
      router.replace(`${localizedPath}${search}${hash}`)

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
