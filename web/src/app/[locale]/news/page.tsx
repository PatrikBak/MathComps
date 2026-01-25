import fs from 'fs'
import type { Metadata } from 'next'
import path from 'path'
import { Suspense } from 'react'

import { NewsList } from '@/components/features/news/NewsList'
import type { NewsArticle, NewsIndexEntry } from '@/components/features/news/types'
import Layout from '@/components/layout/Layout'
import newsIndex from '@/content/news.json'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'
import { validateUniqueIds } from '@/lib/validation'

/**
 * Page-specific metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Resolve the locale from the path
  const { locale } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.news',
    path: ROUTES.NEWS,
    useSection: true,
  })
}

/**
 * Directory containing news articles.
 */
const CONTENT_DIR = path.join(process.cwd(), 'src/content/news')

/**
 * Get all news articles for a specific locale.
 * Reads metadata from news.json index and content from .{locale}.mdx files.
 *
 * @param locale - The locale to get articles for.
 *
 * @returns Array of {@link NewsArticle} objects sorted by date (newest first).
 */
export function getAllNewsArticles(locale: Locale): NewsArticle[] {
  // Check if directory exists
  if (!fs.existsSync(CONTENT_DIR)) throw new Error(`Directory ${CONTENT_DIR} does not exist`)

  // Parse the news index
  const entries = newsIndex as unknown as NewsIndexEntry[]

  // Build articles from index + locale-specific content
  const articles: NewsArticle[] = entries.map((entry) => {
    // Read locale-specific MDX file
    const mdxFile = `${entry.slug}.${locale}.mdx`
    const mdxPath = path.join(CONTENT_DIR, mdxFile)

    // Ensure the translation exists
    if (!fs.existsSync(mdxPath)) {
      throw new Error(`Missing translation: ${mdxFile} for article "${entry.slug}"`)
    }

    // Read MDX content (no frontmatter - just the body)
    const content = fs.readFileSync(mdxPath, 'utf-8').trim()

    // Validate content exists
    if (!content) {
      throw new Error(`Empty content in ${mdxFile}`)
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      throw new Error(
        `Invalid date format for "${entry.slug}". Expected YYYY-MM-DD, got: ${entry.date}`
      )
    }

    // Return article data
    return {
      id: entry.id,
      title: entry.title[locale],
      date: entry.date,
      category: entry.category,
      author: entry.author,
      content,
    }
  })

  // Check for duplicate IDs
  validateUniqueIds(articles, (article) => article.id, 'news article')

  // Sort by date (newest first)
  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/**
 * The news list page, centered mid-screen.
 */
export default withLocale(async function NovinkyPage({ locale }) {
  return (
    <Layout wider centerMidscreen>
      <Suspense>
        <NewsList articles={getAllNewsArticles(locale)} />
      </Suspense>
    </Layout>
  )
})
