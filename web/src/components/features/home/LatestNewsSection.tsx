import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getAllNewsArticles } from '@/components/features/news/news-loader'
import { NewsCard } from '@/components/features/news/NewsCard'
import { AppLink } from '@/components/shared/components/AppLink'
import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'

import { HomeSection, SectionHeading } from './HomeSection'

/**
 * How many of the newest articles to surface.
 */
const HOME_NEWS_COUNT = 3

/**
 * Props for the {@link LatestNewsSection} component.
 */
type LatestNewsSectionProps = {
  /** The locale to resolve article titles and bodies to. */
  locale: Locale
}

/**
 * The most recent news.
 */
export default async function LatestNewsSection({ locale }: LatestNewsSectionProps) {
  // Copy for the section header
  const t = await getTranslations('home.news')

  // The newest few articles
  const articles = (await getAllNewsArticles(locale)).slice(0, HOME_NEWS_COUNT)

  return (
    <HomeSection>
      {/* Header: section title and a link to the full feed */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <SectionHeading>{t('title')}</SectionHeading>
        <AppLink
          href={ROUTES.NEWS}
          plain
          className={cn(
            'group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover',
            FOCUS_RING_CLASS
          )}
        >
          {t('seeAll')}
          <ArrowRight
            size={15}
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </AppLink>
      </div>

      {/* The newest articles */}
      <div className="flex flex-col gap-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </HomeSection>
  )
}
