/**
 * Types for the Novinky (News) section.
 */

import type { LocalizedString } from '@/i18n/i18n'

/**
 * Available news article categories
 */
export type NewsCategory = 'archive' | 'handouts' | 'development' | 'misc'

/**
 * News article metadata from news.json index (raw JSON structure).
 * This is the structure stored in the index file before locale-specific content is loaded.
 */
export type NewsIndexEntry = {
  /** Unique identifier for the article */
  id: string
  /** Slug used for content file lookup (English-first) */
  slug: string
  /** Localized article title */
  title: LocalizedString
  /** Publication date (YYYY-MM-DD) */
  date: string
  /** Category of the article */
  category: NewsCategory
  /** Author of the article */
  author: string
}

/**
 * A single news article
 */
export type NewsArticle = {
  /** Permanent unique identifier (nanoid from frontmatter) */
  id: string
  /** Article title */
  title: string
  /** Publication date (ISO string) */
  date: string
  /** Category for color coding */
  category: NewsCategory
  /** Author name */
  author: string
  /** MDX content body (rendered in cards) */
  content: string
}

/**
 * Category display configuration (colors only).
 * Labels are provided via translations.
 */
export const CATEGORY_CONFIG: Record<NewsCategory, { bgColor: string }> = {
  archive: {
    bgColor: 'bg-indigo-500/80',
  },
  handouts: {
    bgColor: 'bg-green-500/80',
  },
  development: {
    bgColor: 'bg-slate-500/80',
  },
  misc: {
    bgColor: 'bg-violet-500/80',
  },
}
