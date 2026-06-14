'use client'

import { MessageSquare, MessageSquarePlus, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CommentCountProvider,
  useCommentCount,
} from '@/components/features/comments/components/CommentCountContext'
import { CommentModal } from '@/components/features/comments/components/CommentModal'
import { usePendingCommentTarget } from '@/components/features/comments/hooks/use-pending-comment-target'
import { CountBadge } from '@/components/shared/components/CountBadge'
import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

import { CATEGORY_COLORS } from './news-colors'
import { type NewsArticle, type NewsCategory } from './types'

/**
 * How many entries to show before the "older news" reveal.
 */
const INITIAL_VISIBLE = 8

/**
 * A timeline date split into its day/month and year parts.
 */
type TimelineDate = { dayMonth: string; year: string }

/**
 * Validates and parses the category URL parameter.
 *
 * @param value The category value to validate.
 *
 * @returns The category if valid, otherwise null.
 */
function parseCategory(value: string | null): NewsCategory | null {
  // Guard against null
  if (value === null) return null

  // Guard against invalid categories
  if (!Object.keys(CATEGORY_COLORS).includes(value)) return null

  // Return the category
  return value as NewsCategory
}

/**
 * Props for the {@link NewsCommentButton} component.
 */
type NewsCommentButtonProps = {
  /** The article ID to get the count for */
  articleId: string
  /** The click handler to open comments modal */
  openComments: () => void
}

/**
 * Comment button specific to the news timeline.
 */
function NewsCommentButton({ articleId, openComments }: NewsCommentButtonProps) {
  // Translations for the comments label
  const t = useTranslations('news')

  // Get the count from the context
  const { count, isLoading } = useCommentCount(articleId)

  // Once loaded, an empty thread shows a quiet "add a comment" invite
  const isEmpty = !isLoading && count === 0

  return (
    <button
      onClick={openComments}
      className="w-fit flex items-center gap-3 py-1.5 px-3 -ml-3 text-muted hover:text-foreground hover:bg-surface/50 rounded-lg transition-colors"
    >
      {isEmpty ? (
        // Empty: invite to comment, no count
        <MessageSquarePlus size={18} />
      ) : (
        // Loading or has comments: show the count badge
        <div className="flex items-center gap-1.5">
          <CountBadge count={count} color="indigo" isHighlighted={count > 0} isLoading={isLoading}>
            <MessageSquare size={18} />
          </CountBadge>
        </div>
      )}
      <span className="text-sm font-medium">{isEmpty ? t('addComment') : t('comments')}</span>
    </button>
  )
}

/**
 * A single item in the news timeline, pairing article data with its rendered card.
 */
type NewsTimelineItem = {
  /** The article data for filtering and timeline display */
  article: NewsArticle
  /** The pre-rendered card component */
  card: React.ReactNode
}

/**
 * Props for the {@link NewsTimeline} component.
 */
type NewsTimelineProps = {
  /** Array of timeline items containing article data and pre-rendered cards */
  items: NewsTimelineItem[]
}

/**
 * A vertical timeline of news: dates run down the left with a connecting rail,
 * newest on top. Scales to any number of posts and keeps the page top-aligned.
 */
export function NewsTimeline({ items }: NewsTimelineProps) {
  // Translations for the news timeline
  const t = useTranslations('news')

  // Translations for the news categories
  const tCategories = useTranslations('news.categories')

  // Date formatter (uses current locale automatically)
  const format = useFormatter()

  // The navigation used to clear the category filter
  const router = useRouter()

  // Parse and validate the category filter from the URL
  const categoryFilter = parseCategory(useSearchParams().get('category'))

  // Whether the older entries past the initial window are revealed
  const [showAll, setShowAll] = useState(false)

  // Selected article for comments modal
  const [commentsArticle, setCommentsArticle] = useState<NewsArticle | null>(null)

  // Whether the comments modal is open
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  // Extract article IDs for batch fetching comment counts
  const articleIds = items.map((item) => item.article.id)

  // Ensure invalid categories are stripped out of the url
  useEffect(() => {
    if (categoryFilter === null) router.replace(ROUTES.NEWS)
  }, [categoryFilter, router])

  // Filter items by category
  const filteredItems = useMemo(() => {
    // No filtering if no category is selected
    if (!categoryFilter) return items

    // Otherwise filter by category
    return items.filter((item) => item.article.category === categoryFilter)
  }, [items, categoryFilter])

  // The slice currently shown — capped until the reader asks for older news
  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, INITIAL_VISIBLE)

  // How many entries are still hidden behind the reveal
  const hiddenCount = filteredItems.length - visibleItems.length

  /**
   * Function to open the comments modal for an article
   *
   * @param article The article to open the comments modal for
   */
  const openComments = useCallback((article: NewsArticle) => {
    // Set the current article
    setCommentsArticle(article)

    // Open the modal
    setIsCommentsOpen(true)
  }, [])

  // Hook for restoring comment modal state
  const { pendingTarget, clearPendingTarget } = usePendingCommentTarget()

  // Check for pending comment target on mount (after login redirect)
  useEffect(() => {
    // If there is a pending target and it is a news article
    if (pendingTarget && pendingTarget.targetType === 'News') {
      // Find the matching article
      const match = items.find((item) => item.article.id === pendingTarget.targetId)

      // If we found a match
      if (match) {
        // Open the comments modal
        openComments(match.article)
      }
    }
  }, [items, pendingTarget, openComments])

  /** Function to clear the category filter */
  const clearFilter = () => {
    // URL change will trigger a re-render cause we're parsing the category from the URL
    router.push(ROUTES.NEWS)
  }

  /** Function to format a date into its day/month and year parts */
  const formatTimelineDate = (dateString: string): TimelineDate => {
    // Parse the date string into a Date object
    const date = new Date(dateString)

    // Format day + month with locale-aware ordering
    const dayMonth = format.dateTime(date, { day: 'numeric', month: 'numeric' })

    return { dayMonth, year: date.getFullYear().toString() }
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10">
      {/* Title stays in the DOM for SEO and screen readers; the running feed below makes it
          visually redundant, so it's hidden to let content start right under the nav. */}
      <h1 className="sr-only">{t('title')}</h1>

      {/* Filter indicator - appears when a category filter is active */}
      {categoryFilter && (
        <div className="flex items-center gap-2 mb-8">
          <span className="text-sm text-muted-foreground">{t('filtering')}</span>
          <button
            onClick={clearFilter}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md text-white',
              CATEGORY_COLORS[categoryFilter].bg,
              'hover:opacity-80 transition-opacity'
            )}
          >
            {tCategories(categoryFilter)}
            <X size={14} />
          </button>
        </div>
      )}

      {filteredItems.length > 0 && (
        <CommentCountProvider targetType="News" targetIds={articleIds}>
          <div className="flex flex-col">
            {visibleItems.map((item, index) => {
              // Day/month + year for the left rail (desktop)
              const dateInfo = formatTimelineDate(item.article.date)

              // Newest entry gets a lit dot; older ones a quiet hollow one
              const isNewest = index === 0

              return (
                <div key={item.article.id} className="flex gap-0 md:gap-5">
                  {/* Left rail with date + dot (desktop only) */}
                  <div className="hidden md:flex shrink-0 gap-3">
                    {/* Date */}
                    <div className="w-14 pt-0.5 text-right">
                      <div className="text-sm font-semibold text-foreground tabular-nums">
                        {dateInfo.dayMonth}
                      </div>
                      <div className="text-xs text-muted mt-0.5">{dateInfo.year}</div>
                    </div>

                    {/* Rail line + dot */}
                    <div className="relative flex justify-center w-3">
                      <div className="absolute top-2 bottom-0 w-px bg-foreground/10" />
                      <div
                        className={cn(
                          'relative mt-1 w-3 h-3 rounded-full border-2',
                          isNewest
                            ? 'bg-focus-light border-focus-light'
                            : 'bg-background border-foreground/25'
                        )}
                      />
                    </div>
                  </div>

                  {/* Entry: the card + its comment affordance */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2 pb-10">
                    {item.card}
                    <NewsCommentButton
                      articleId={item.article.id}
                      openComments={() => openComments(item.article)}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reveal for older entries */}
          {hiddenCount > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShowAll(true)}
                className="px-5 py-2 text-sm font-medium text-muted hover:text-foreground border border-foreground/10 hover:border-foreground/25 rounded-lg transition-colors"
              >
                {t('showOlder')} ({hiddenCount})
              </button>
            </div>
          )}
        </CommentCountProvider>
      )}

      {/* Comments Modal */}
      <CommentModal
        isOpen={isCommentsOpen}
        onClose={() => {
          // Close the modal
          setIsCommentsOpen(false)

          // No more pending target in case we wanna log in from this comment section
          clearPendingTarget()
        }}
        title={commentsArticle?.title ?? ''}
        target={{
          targetType: 'News',
          targetId: commentsArticle?.id ?? '',
        }}
      />
    </div>
  )
}
