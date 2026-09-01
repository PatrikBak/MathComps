import type { ReactNode } from 'react'

import type { LocalizedString } from '@/i18n/i18n'

import type { NewsIconName } from './news-icons'

/**
 * Available news article categories.
 */
export const NEWS_CATEGORIES = [
  'archive',
  'handouts',
  'competitions',
  'development',
  'misc',
] as const

/**
 * A news article category.
 */
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

/**
 * A hand-drawn handout figure, rendered from an SVG.
 */
type NewsFigureCover = {
  /** Discriminant. */
  kind: 'figure'
  /** Public path to the SVG (e.g. /news/equal-tangents.svg). */
  src: string
}

/**
 * A KaTeX-rendered expression.
 */
type NewsEquationCover = {
  /** Discriminant. */
  kind: 'equation'
  /** The LaTeX body (no delimiters), rendered in display mode. */
  latex: string
}

/**
 * A line icon.
 */
type NewsIconCover = {
  /** Discriminant. */
  kind: 'icon'
  /** Which registered icon to render. */
  name: NewsIconName
}

/**
 * The cover art for a news card: a hand-drawn handout figure, a rendered equation, or a line icon.
 */
export type NewsCover = NewsFigureCover | NewsEquationCover | NewsIconCover

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
  /** Cover art shown on the card. */
  cover: NewsCover
}

/**
 * A single news article, resolved to one locale from a {@link NewsIndexEntry}.
 */
export type NewsArticle = Omit<NewsIndexEntry, 'slug' | 'title'> & {
  /** Article title resolved to the current locale. */
  title: string
  /** MDX content body (rendered in cards). */
  content: string
}

/**
 * A single entry in the news timeline: an article paired with its pre-rendered card.
 */
export type NewsTimelineItem = {
  /** The entry's article. */
  article: NewsArticle
  /** The article's pre-rendered card. */
  card: ReactNode
}
