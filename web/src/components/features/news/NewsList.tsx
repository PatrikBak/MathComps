import { NewsCard } from './NewsCard'
import { NewsTimeline } from './NewsTimeline'
import type { NewsArticle } from './types'

/**
 * Props for the {@link NewsList} component.
 */
type NewsListProps = {
  /** Array of news articles to display. */
  articles: NewsArticle[]
}

/**
 * Server component that renders news articles. Passes pre-rendered {@link NewsCard}
 * components to the client-side {@link NewsTimeline}.
 */
export function NewsList({ articles }: NewsListProps) {
  return (
    <NewsTimeline
      items={articles.map((article) => ({
        article,
        card: <NewsCard key={article.id} article={article} />,
      }))}
    />
  )
}
