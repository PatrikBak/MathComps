import type {
  BreadcrumbList,
  EducationalOrganization,
  Graph,
  Person,
  WithContext,
} from 'schema-dts'

import { getCanonicalUrl } from '@/components/shared/utils/url-utils'
import {
  AUTHOR_GITHUB_URL,
  AUTHOR_LINKEDIN_URL,
  AUTHOR_NAME,
  AUTHOR_PHOTO_PATH,
} from '@/constants/author'
import { SITE_NAME } from '@/constants/og-metadata'
import { type Locale, ROUTES } from '@/i18n/i18n'
import { resolveLocalizedPath } from '@/i18n/localized-paths'

/**
 * The organization's own first-party profile (its source repository).
 */
const ORGANIZATION_SAME_AS = ['https://github.com/PatrikBak/MathComps']

/**
 * Inputs for {@link buildSiteJsonLd}.
 */
type SiteJsonLdParams = {
  /** The target locale. */
  locale: Locale
  /** The localized site description. */
  siteDescription: string
  /** The localized author bio. */
  authorDescription: string
}

/**
 * Builds the site-wide structured data: an
 * {@link https://schema.org/EducationalOrganization | EducationalOrganization} and its founder
 * {@link https://schema.org/Person | Person}. Both carry a stable `@id` so the nodes cross-reference
 * and later per-page nodes can point at the same entities.
 *
 * @returns The schema.org graph to serialize into the page.
 */
export function buildSiteJsonLd({
  locale,
  siteDescription,
  authorDescription,
}: SiteJsonLdParams): Graph {
  // Stable root-anchored @ids the two nodes reference each other by
  const organizationId = getCanonicalUrl('/#organization')
  const personId = getCanonicalUrl('/#person')

  // Home URL for this locale (e.g. https://mathcomps.fun/sk)
  const homeUrl = getCanonicalUrl(`/${locale}`)

  // Localized About path, where the author's bio lives (/o-projekte, /o-projektu, /about)
  const aboutPath = resolveLocalizedPath(ROUTES.ABOUT, locale)

  // resolveLocalizedPath widens to undefined for an unresolved slug; a static route can't hit that
  if (aboutPath === undefined) {
    throw new Error(`[JSON-LD] Missing about path for locale '${locale}'.`)
  }

  // The organization behind the site
  const organization: EducationalOrganization = {
    '@type': 'EducationalOrganization',
    '@id': organizationId,
    name: SITE_NAME,
    url: homeUrl,
    logo: getCanonicalUrl('/logo-mathcomps.png'),
    description: siteDescription,
    sameAs: ORGANIZATION_SAME_AS,
    founder: { '@id': personId },
  }

  // The author, linked to their real profiles and back to the organization
  const person: Person = {
    '@type': 'Person',
    '@id': personId,
    name: AUTHOR_NAME,
    url: getCanonicalUrl(`/${locale}${aboutPath}`),
    image: getCanonicalUrl(AUTHOR_PHOTO_PATH),
    description: authorDescription,
    knowsAbout: ['Mathematical olympiads', 'Competition mathematics'],
    sameAs: [AUTHOR_LINKEDIN_URL, AUTHOR_GITHUB_URL],
    worksFor: { '@id': organizationId },
  }

  // Assemble the linked graph
  return {
    '@context': 'https://schema.org',
    '@graph': [organization, person],
  }
}

/**
 * One rung of a breadcrumb trail.
 */
export type BreadcrumbItem = {
  /** The human-readable label for the rung. */
  name: string
  /** The absolute URL the rung links to; omit for the current page (the last rung). */
  url?: string
}

/**
 * Builds a {@link https://schema.org/BreadcrumbList | BreadcrumbList} from an ordered trail. Positions
 * are 1-based; a rung without a `url` (the current page) emits no `item`, as Google expects.
 *
 * @param items - The trail, root first.
 *
 * @returns The BreadcrumbList node to serialize.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    // Turn each rung into a 1-based ListItem; the current page (no url) carries no item
    itemListElement: items.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      ...(entry.url ? { item: entry.url } : {}),
    })),
  }
}
