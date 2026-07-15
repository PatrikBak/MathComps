import type { MetadataRoute } from 'next'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'

/**
 * AI crawlers that fetch pages to build model training corpora. We opt these out while still
 * welcoming AI *search* crawlers (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Bingbot, ...),
 * which fetch at query time and can cite the site back with a referral link — those fall under the
 * catch-all allow rule. Google-Extended and Applebot-Extended are opt-out tokens (never seen as a
 * live user-agent); listing them here gates Gemini and Apple Intelligence training only, leaving
 * Googlebot's normal search crawl untouched.
 */
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
  'Meta-ExternalAgent',
  'Bytespider',
  'cohere-ai',
]

/**
 * Site-wide crawl policy. Allows everything and points crawlers at the sitemap, but disallows the
 * AI model-training crawlers in {@link AI_TRAINING_CRAWLERS}. Auth/profile pages are kept out of the
 * index by their per-page `noindex` meta, not disallowed here (a disallow would stop crawlers
 * fetching them and so hide that very `noindex`).
 *
 * @returns The robots.txt configuration.
 */
export default function robots(): MetadataRoute.Robots {
  // The configured site origin
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')

  // Allow every crawler by default; the training crawlers get a more specific disallow group
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: AI_TRAINING_CRAWLERS, disallow: '/' },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
