import fs from 'fs'
import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import path from 'path'
import { Suspense } from 'react'

import { NewsCard } from '@/components/features/news/NewsCard'
import { NewsTimeline } from '@/components/features/news/NewsTimeline'
import {
  type NewsArticle,
  type NewsIndexEntry,
  type NewsTimelineItem,
} from '@/components/features/news/types'
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
 * Cached: committed content only turns over on deploy, so the parsed articles are held for the longest
 * profile and re-read once per locale rather than on every request.
 *
 * @param locale - The locale to get articles for.
 *
 * @returns Array of {@link NewsArticle} objects sorted by date (newest first).
 */
async function getAllNewsArticles(locale: Locale): Promise<NewsArticle[]> {
  'use cache'
  cacheLife('max')

  // Check if directory exists
  if (!fs.existsSync(CONTENT_DIR)) throw new Error(`Directory ${CONTENT_DIR} does not exist`)

  // Parse the news index
  const entries = newsIndex as unknown as NewsIndexEntry[]

  // Build an article per index entry
  const articles: NewsArticle[] = entries.map((entry) => {
    // Read locale-specific MDX file
    const mdxFile = `${entry.slug}.${locale}.mdx`
    const mdxPath = path.join(CONTENT_DIR, mdxFile)

    // Ensure the translation exists
    if (!fs.existsSync(mdxPath)) {
      throw new Error(`Missing translation: ${mdxFile} for article "${entry.slug}"`)
    }

    // Read the trimmed MDX body
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

    // Assemble the article for this locale
    return {
      id: entry.id,
      title: entry.title[locale],
      date: entry.date,
      category: entry.category,
      cover: entry.cover,
      content,
    }
  })

  // Check for duplicate IDs
  validateUniqueIds(articles, (article) => article.id, 'news article')

  // Sort by date (newest first)
  return articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/**
 * The news list page. The cached articles compile into the initial HTML so every post is crawlable;
 * the category filter reads the URL and hydrates on top.
 */
export default withLocale(async function NovinkyPage({ locale }: { locale: Locale }) {
  // Load the cached articles for this locale
  const articles = await getAllNewsArticles(locale)

  // Pair each article with its pre-rendered card
  const items: NewsTimelineItem[] = articles.map((article) => ({
    article,
    card: <NewsCard key={article.id} article={article} />,
  }))

  // Render the timeline over every article; the category filter reads the URL, so it sits behind a
  // Suspense boundary
  return (
    <Layout wider>
      <Suspense fallback={null}>
        <NewsTimeline items={items} />
      </Suspense>
    </Layout>
  )
})
