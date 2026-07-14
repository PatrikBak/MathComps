import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { getCanonicalUrl } from '@/components/shared/utils/url-utils'
import { SITE_NAME, SITE_TITLE, TWITTER_CARD_TYPE } from '@/constants/og-metadata'
import type { Locale } from '@/i18n/i18n'
import {
  buildAlternateLanguages,
  resolveLocalizedPath,
  toLocaleUrlSuffix,
} from '@/i18n/localized-paths'

/**
 * Maps locale code to OG locale format (e.g., 'sk' -> 'sk_SK').
 */
const LOCALE_TO_OG_LOCALE: Record<Locale, string> = {
  sk: 'sk_SK',
  en: 'en_US',
  cs: 'cs_CZ',
}

/**
 * Site-level metadata that varies by locale.
 */
type SiteMetadata = {
  /** Localized site description for SEO and OG tags. */
  description: string
  /** OG locale format (e.g., 'sk_SK'). */
  ogLocale: string
  /** HTML lang attribute value. */
  lang: Locale
}

/**
 * Fetches locale-aware site metadata from translations.
 * Use this for root-level metadata that needs localization.
 *
 * @param locale - The target locale.
 *
 * @returns Site metadata for the given locale.
 */
export async function getSiteMetadata(locale: Locale): Promise<SiteMetadata> {
  // Get site-level translations
  const t = await getTranslations({ locale, namespace: 'metadata.site' })

  // Get the description
  const description = t('description')

  // Return the site metadata
  return {
    description,
    ogLocale: LOCALE_TO_OG_LOCALE[locale],
    lang: locale,
  }
}

/**
 * Options for generating page metadata.
 */
type PageMetadataOptions = {
  /** Page title (will be appended with site name). */
  title?: string
  /** Page description for SEO and OG tags. */
  description?: string
  /** URL path for canonical URL generation. */
  path?: string
  /** Open Graph content type ('website' or 'article'). */
  type?: 'website' | 'article'
  /** Open Graph section for content categorization. */
  section?: string
  /** The locale for OG metadata. */
  locale: Locale
  /** Optional slug translations for dynamic routes. */
  slugTranslations?: Record<Locale, string>
  /** Whether to prevent search engines from indexing the page. */
  noindex?: boolean
}

/**
 * Internal helper to generate metadata for a specific page.
 *
 * @param options - The Next.js metadata options.
 *
 * @returns The generated metadata.
 */
export function generatePageMetadata(options: PageMetadataOptions): Metadata {
  // Get the options we care about
  const {
    title,
    description,
    path = '',
    type = 'website',
    section,
    locale,
    slugTranslations,
    noindex = false,
  } = options

  // Get locale-specific values
  const ogLocale = LOCALE_TO_OG_LOCALE[locale]

  // Resolve the fully localized path for the current locale (includes slug substitution)
  const localizedPath = resolveLocalizedPath(path, locale, slugTranslations)

  // Fail loudly if the path couldn't be resolved (e.g. missing slug translation)
  if (localizedPath === undefined) {
    throw new Error(`[Metadata] Missing slug translation for locale '${locale}' on path '${path}'.`)
  }

  // Generate canonical URL with locale prefix (e.g. https://site.com/sk/o-projekte)
  const url = getCanonicalUrl(`/${locale}${toLocaleUrlSuffix(localizedPath)}`)

  // Generate the per-locale OG image URL
  const ogImage = `${getRequiredEnv('NEXT_PUBLIC_SITE_URL')}/og-image.${locale}.png`
  const finalImageAlt = title ? `${title} - ${SITE_NAME}` : SITE_NAME

  // Build the page title (layout template will add site name automatically)
  const pageTitle = title || SITE_TITLE

  // Return the metadata
  return {
    title: pageTitle,
    description,

    // Canonical URL and alternate languages (hreflang)
    alternates: {
      canonical: url,
      languages: buildAlternateLanguages(path, slugTranslations),
    },

    // Open Graph
    openGraph: {
      title: title || SITE_TITLE,
      description,
      siteName: SITE_NAME,
      locale: ogLocale,
      type,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: finalImageAlt,
        },
      ],
      ...(section && { section }),
    },

    // Twitter/X
    twitter: {
      card: TWITTER_CARD_TYPE,
      title: title || SITE_TITLE,
      description,
      images: [ogImage],
    },

    // Robots
    robots: noindex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  }
}

/**
 * Valid metadata translation namespaces.
 * Must contain 'title' and 'description' keys.
 */
type MetadataNamespace =
  | 'metadata.home'
  | 'metadata.about'
  | 'metadata.problems'
  | 'metadata.guide'
  | 'metadata.profile'
  | 'metadata.handouts'
  | 'metadata.login'
  | 'metadata.privacy'
  | 'metadata.news'

/**
 * Options for creating page metadata with automatic translations.
 */
type CreatePageMetadataOptions = {
  /** The current locale. */
  locale: Locale
  /** Translation namespace containing 'title' and 'description' keys. */
  namespace: MetadataNamespace
  /** URL path for canonical URL generation. */
  path?: string
  /** Open Graph content type ('website' or 'article'). */
  type?: 'website' | 'article'
  /** Whether to use title as section (for OG tags). */
  useSection?: boolean
  /** Whether to prevent search engines from indexing the page. */
  noindex?: boolean
}

/**
 * Creates page metadata with automatic translation loading.
 * Simplifies the common pattern of fetching translations for metadata.
 * The translation namespace must contain 'title' and 'description' keys.
 *
 * @param options - The options for creating page metadata.
 *
 * @returns The generated metadata.
 */
export async function createPageMetadata({
  locale,
  namespace,
  path = '',
  type = 'website',
  useSection = false,
  noindex = false,
}: CreatePageMetadataOptions): Promise<Metadata> {
  // Get the translations
  const t = await getTranslations({ locale, namespace })

  // Get the title and description
  const title = t('title')
  const description = t('description')

  // Return the metadata
  return generatePageMetadata({
    title,
    description,
    path,
    type,
    section: useSection ? title : undefined,
    locale,
    noindex,
  })
}
