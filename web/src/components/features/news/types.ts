/**
 * Types for the Novinky (News) section.
 */

/**
 * Available news article categories
 */
export type NewsCategory = 'archive' | 'handouts' | 'development' | 'misc'

/**
 * A single news article
 */
export type NewsArticle = {
  /** Unique identifier (slug) */
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
 * Category display configuration
 */
export const CATEGORY_CONFIG: Record<NewsCategory, { label: string; bgColor: string }> = {
  archive: {
    label: 'Archív',
    bgColor: 'bg-indigo-500/80',
  },
  handouts: {
    label: 'Materiály',
    bgColor: 'bg-green-500/80',
  },
  development: {
    label: 'Vývoj',
    bgColor: 'bg-slate-500/80',
  },
  misc: {
    label: 'Rôzne',
    bgColor: 'bg-violet-500/80',
  },
}
