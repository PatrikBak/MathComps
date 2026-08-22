'use client'

import { MessageSquare, MessageSquarePlus, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'

import {
  CommentCountProvider,
  useCommentCount,
} from '@/components/features/comments/components/CommentCountContext'
import { CommentModal } from '@/components/features/comments/components/CommentModal'
import { usePendingCommentTarget } from '@/components/features/comments/hooks/use-pending-comment-target'
import { Button } from '@/components/shared/components/Button'
import { CountBadge } from '@/components/shared/components/CountBadge'
import { FilterEmptyState } from '@/components/shared/components/FilterEmptyState'
import { parseMember } from '@/components/shared/utils/collection-utils'
import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

import { CATEGORY_COLORS } from './news-colors'
import { NEWS_CATEGORIES, type NewsArticle, type NewsTimelineItem } from './types'

/**
 * How many entries to show before the "older news" reveal.
 */
const INITIAL_VISIBLE = 8

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

  // Loaded, and the thread has no comments yet
  const isEmpty = !isLoading && count === 0

  return (
    <Button variant="ghost" onClick={openComments} className="w-fit gap-3 -ml-3">
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
    </Button>
  )
}

/**
 * Props for the {@link NewsTimeline} component.
 */
type NewsTimelineProps = {
  /** Every timeline entry — the full, unfiltered set. */
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

  // The active category from the URL (null when absent or unrecognized = show everything)
  const activeCategory = parseMember(useSearchParams().get('category'), NEWS_CATEGORIES)

  // Whether the older entries past the initial window are revealed
  const [showAll, setShowAll] = useState(false)

  // Selected article for comments modal
  const [commentsArticle, setCommentsArticle] = useState<NewsArticle | null>(null)

  // Whether the comments modal is open
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  // Extract article IDs for batch fetching comment counts
  const articleIds = items.map((item) => item.article.id)

  // The entries matching the active category (every article when there's no filter)
  const filteredItems = activeCategory
    ? items.filter((item) => item.article.category === activeCategory)
    : items

  // How many entries show at rest, before the reader asks for older news
  const restingCount = Math.min(INITIAL_VISIBLE, filteredItems.length)

  // The count on screen right now: all of them once the older entries are revealed
  const visibleCount = showAll ? filteredItems.length : restingCount

  // How many entries are still tucked behind the reveal
  const hiddenCount = filteredItems.length - visibleCount

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
    // Drop the filter from the URL; the re-read then shows everything
    router.push(ROUTES.NEWS)
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 pb-10">
      {/* Kept in the DOM for SEO and screen readers, hidden visually */}
      <h1 className="sr-only">{t('title')}</h1>

      {/* Filter indicator - appears when a category filter is active */}
      {activeCategory && (
        <div className="flex items-center gap-2 mb-8">
          <span className="text-sm text-muted-foreground">{t('filtering')}</span>
          <button
            onClick={clearFilter}
            className={cn(
              'inline-flex items-center gap-1.5 min-h-11 px-3 text-sm font-medium rounded-md',
              CATEGORY_COLORS[activeCategory].bg,
              CATEGORY_COLORS[activeCategory].text,
              'hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-focus'
            )}
          >
            {tCategories(activeCategory)}
            <X size={14} />
          </button>
        </div>
      )}

      {/* The feed, or an empty state when a category filter matches nothing */}
      {filteredItems.length > 0 ? (
        <CommentCountProvider targetType="News" targetIds={articleIds}>
          <div className="flex flex-col">
            {filteredItems.map((item, index) => {
              // Parse the entry's calendar date for the left rail (desktop)
              const date = new Date(item.article.date)

              // Day + month in locale order; read in UTC so western timezones don't roll back a day
              const dayMonth = format.dateTime(date, {
                day: 'numeric',
                month: 'numeric',
                timeZone: 'UTC',
              })

              // Four-digit year shown beneath it
              const year = date.getUTCFullYear().toString()

              // The first entry is the newest
              const isNewest = index === 0

              // Last visible entry: the rail stops here so it doesn't dangle below the final dot
              const isLast = index === visibleCount - 1

              // Older entries stay in the DOM (crawlable) but hide via CSS until the reader reveals them
              const isHidden = !showAll && index >= INITIAL_VISIBLE

              // Entries past the initial window fade in when "older news" is revealed
              const isRevealed = showAll && index >= INITIAL_VISIBLE

              return (
                <div
                  key={item.article.id}
                  className={cn(
                    'flex gap-0 md:gap-5',
                    isHidden && 'hidden',
                    isRevealed &&
                      'animate-in fade-in slide-in-from-top-1 duration-300 transition-none motion-reduce:animate-none'
                  )}
                >
                  {/* Left rail with date + dot (desktop only) */}
                  <div className="hidden md:flex shrink-0 gap-3">
                    {/* Date */}
                    <div className="w-14 pt-0.5 text-right">
                      <div className="text-sm font-semibold text-foreground tabular-nums">
                        {dayMonth}
                      </div>
                      <div className="text-xs text-muted mt-0.5">{year}</div>
                    </div>

                    {/* Rail line + dot */}
                    <div className="relative flex justify-center w-3">
                      {!isLast && <div className="absolute top-2 bottom-0 w-px bg-foreground/10" />}
                      <div
                        className={cn(
                          'relative mt-1 w-3 h-3 rounded-full border-2',
                          isNewest
                            ? 'bg-brand-light border-brand-light'
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
              <Button variant="secondary" onClick={() => setShowAll(true)}>
                {t('showOlder')} ({hiddenCount})
              </Button>
            </div>
          )}
        </CommentCountProvider>
      ) : (
        <FilterEmptyState
          message={t('emptyState')}
          resetLabel={t('clearFilter')}
          onReset={clearFilter}
        />
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
