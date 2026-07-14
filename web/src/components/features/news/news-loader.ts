import fs from 'fs'
import { cacheLife } from 'next/cache'
import path from 'path'

import newsIndex from '@/content/news.json'
import type { Locale } from '@/i18n/i18n'
import { validateUniqueIds } from '@/lib/validation'

import { type NewsArticle, type NewsIndexEntry } from './types'

/**
 * Directory holding the per-locale MDX bodies, one file per article slug.
 */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/news')

/**
 * Reads every news article for a locale: metadata from the news.json index, body from the
 * matching `.{locale}.mdx` file. Returned newest-first.
 *
 * Cached for the longest profile; committed content only turns over on deploy.
 *
 * @param locale - The locale to resolve titles and bodies to.
 *
 * @returns Every {@link NewsArticle}, sorted by date descending.
 */
export async function getAllNewsArticles(locale: Locale): Promise<NewsArticle[]> {
  'use cache'
  cacheLife('max')

  // The content directory must exist for any article to resolve
  if (!fs.existsSync(CONTENT_DIR)) throw new Error(`Directory ${CONTENT_DIR} does not exist`)

  // The index carries each article's metadata
  const entries = newsIndex as unknown as NewsIndexEntry[]

  // Build one localized article per index entry
  const articles: NewsArticle[] = entries.map((entry) => {
    // The locale-specific MDX body lives alongside the index by slug
    const mdxFile = `${entry.slug}.${locale}.mdx`
    const mdxPath = path.join(CONTENT_DIR, mdxFile)

    // A missing translation is a content error, not a silent fallback
    if (!fs.existsSync(mdxPath)) {
      throw new Error(`Missing translation: ${mdxFile} for article "${entry.slug}"`)
    }

    // Read the trimmed MDX body
    const content = fs.readFileSync(mdxPath, 'utf-8').trim()

    // An empty body is likewise a content error
    if (!content) {
      throw new Error(`Empty content in ${mdxFile}`)
    }

    // The date drives sort order, so its shape is validated up front
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      throw new Error(
        `Invalid date format for "${entry.slug}". Expected YYYY-MM-DD, got: ${entry.date}`
      )
    }

    // Assemble the article resolved to this locale
    return {
      id: entry.id,
      title: entry.title[locale],
      date: entry.date,
      category: entry.category,
      cover: entry.cover,
      content,
    }
  })

  // Article ids must be unique, so reject duplicates up front
  validateUniqueIds(articles, (article) => article.id, 'news article')

  // Newest first
  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
