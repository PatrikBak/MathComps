import type { Metadata } from 'next'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import {
  DEFAULT_OG_METADATA,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  TWITTER_CARD_TYPE,
} from '@/constants/og-metadata'

/**
 * Generate canonical URL for a path
 */
export function getCanonicalUrl(path: string = ''): string {
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${siteUrl}${cleanPath}`
}

/**
 * Options for generating page metadata
 */
interface PageMetadataOptions {
  /** Page title (will be appended with site name) */
  title?: string
  /** Page description for SEO and OG tags */
  description?: string
  /** URL path for canonical URL generation */
  path?: string
  /** Open Graph content type ('website' or 'article') */
  type?: 'website' | 'article'
  /** Open Graph section for content categorization */
  section?: string
}

/**
 * Generate metadata for a specific page
 * Follows OG and Twitter Card best practices
 *
 * @param options - Page metadata configuration
 * @returns Complete Next.js Metadata object with OG tags, Twitter cards, and SEO metadata
 */
export function generatePageMetadata(options: PageMetadataOptions = {}): Metadata {
  const { title, description = SITE_DESCRIPTION, path = '', type = 'website', section } = options

  // Generate full URLs
  const url = getCanonicalUrl(path)
  const ogImage = `${getRequiredEnv('NEXT_PUBLIC_SITE_URL')}/og-image.png`
  const finalImageAlt = title ? `${title} - ${SITE_NAME}` : `${SITE_NAME} - ${SITE_DESCRIPTION}`

  // Build the page title (layout template will add site name automatically)
  const pageTitle = title || SITE_TITLE

  // Base metadata
  const metadata: Metadata = {
    title: pageTitle,
    description,

    // Canonical URL
    alternates: {
      canonical: url,
    },

    // Open Graph
    openGraph: {
      ...DEFAULT_OG_METADATA,
      title: title || SITE_TITLE,
      description,
      url,
      type,
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
      creator: SITE_NAME,
    },

    // Robots
    robots: {
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

  return metadata
}
