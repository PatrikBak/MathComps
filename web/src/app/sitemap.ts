import type { MetadataRoute } from 'next'

import type { HandoutIndex } from '@/components/features/handouts/handout-metadata-types'
import { isPublicHandout } from '@/components/features/handouts/handout-metadata-types'
import handoutIndex from '@/content/handouts.json'
import type { Locale } from '@/i18n/i18n'
import { ROUTES, SUPPORTED_LOCALES } from '@/i18n/i18n'
import { buildAlternateLanguages } from '@/lib/metadata'

/** Typed access to the handout index. */
const index = handoutIndex as unknown as HandoutIndex

/**
 * Public static routes to enumerate, one entry per locale.
 * Auth/profile/sso are excluded (noindexed); handout detail pages are added separately.
 */
const STATIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.ABOUT,
  ROUTES.GUIDE,
  ROUTES.HANDOUTS,
  ROUTES.PROBLEMS,
  ROUTES.NEWS,
  ROUTES.PRIVACY,
]

/**
 * Builds one sitemap entry per locale for a route, sharing the route's full hreflang alternate set.
 *
 * @param canonicalPath - The canonical route path (e.g. '/about' or '/handouts/[slug]').
 * @param slugTranslations - Optional localized slugs for a dynamic route.
 *
 * @returns One entry per resolved locale, each advertising every locale as an alternate.
 */
function entriesForRoute(
  canonicalPath: string,
  slugTranslations?: Record<Locale, string>
): MetadataRoute.Sitemap {
  // Resolve every locale's URL plus the hreflang alternate map once
  const languages = buildAlternateLanguages(canonicalPath, slugTranslations)

  // Emit an entry for each locale that actually resolved to a URL
  return SUPPORTED_LOCALES.filter((locale) => languages[locale] !== undefined).map((locale) => ({
    url: languages[locale],
    alternates: { languages },
  }))
}

/**
 * Emits the sitemap: every localized static route plus every public handout detail page,
 * each carrying its hreflang alternates so search engines get the full SK/CS/EN URL set.
 *
 * @returns The sitemap entries.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Static routes across all locales
  const staticEntries = STATIC_ROUTES.flatMap((route) => entriesForRoute(route))

  // Public handouts only (public:false stays out even though it renders by direct URL)
  const publicHandouts = index.sections
    .flatMap((section) => section.handouts)
    .filter(isPublicHandout)

  // One localized entry per handout+locale; unsupported locales have no slug so they drop out
  const handoutEntries = publicHandouts.flatMap((handout) =>
    entriesForRoute(ROUTES.HANDOUT_DETAIL, handout.slug)
  )

  // Hand back the combined list
  return [...staticEntries, ...handoutEntries]
}
