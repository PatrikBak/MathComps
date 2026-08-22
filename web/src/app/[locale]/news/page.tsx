import type { Metadata } from 'next'
import { Suspense } from 'react'

import { getAllNewsArticles } from '@/components/features/news/news-loader'
import { NewsCard } from '@/components/features/news/NewsCard'
import { NewsTimeline } from '@/components/features/news/NewsTimeline'
import { type NewsTimelineItem } from '@/components/features/news/types'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

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
    namespace: 'pages.news',
    path: ROUTES.NEWS,
    useSection: true,
  })
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
