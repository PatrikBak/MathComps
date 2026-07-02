import type { MetadataRoute } from 'next'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'

/**
 * Site-wide crawl policy. Allows everything and points crawlers at the sitemap;
 * auth/profile pages are kept out of the index by their per-page `noindex` meta, not disallowed
 * here (a disallow would stop crawlers fetching them and so hide that very `noindex`).
 *
 * @returns The robots.txt configuration.
 */
export default function robots(): MetadataRoute.Robots {
  // The configured site origin
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')

  // Allow all, advertise the sitemap
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
