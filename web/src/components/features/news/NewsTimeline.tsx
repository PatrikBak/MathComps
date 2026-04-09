'use client'

import { useWindowEvent } from '@mantine/hooks'
import { ChevronLeft, ChevronRight, MessageSquare, Newspaper, X } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useCallback, useEffect, useRef, useState } from 'react'

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
 * Validates and parses the category URL parameter.
 *
 * @param value The category value to validate.
 *
 * @return The category if valid, otherwise null.
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
 * The props for the {@link TimelineNavButton} component.
 */
type TimelineNavButtonProps = {
  /** The direction of the button */
  direction: 'left' | 'right'
  /** The click handler */
  onClick: () => void
  /** Whether the button is visible */
  visible: boolean
}

/**
 * Navigation button for scrolling the timeline horizontally.
 * Positioned on the timeline axis at the left or right edge.
 */
function TimelineNavButton({ direction, onClick, visible }: TimelineNavButtonProps) {
  // Translations for the nav button aria-labels
  const t = useTranslations('news')

  // The correct icon component
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight

  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute bottom-[45px] -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full',
        'bg-background border-2 border-focus/60 text-focus-light',
        'hover:bg-surface-hover hover:border-focus-light hover:text-focus-light',
        'transition-all duration-200',
        direction === 'left' ? 'left-0' : 'right-0',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-label={direction === 'left' ? t('newerArticles') : t('olderArticles')}
    >
      <Icon size={18} strokeWidth={2.5} />
    </button>
  )
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

  return (
    <button
      onClick={openComments}
      className="w-fit self-center flex items-center justify-center gap-4 py-2 px-4 text-muted hover:bg-surface/50 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <CountBadge count={count} color="indigo" isHighlighted={count > 0} isLoading={isLoading}>
          <MessageSquare size={20} />
        </CountBadge>
      </div>
      <span className="text-sm font-medium">{t('comments')}</span>
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
 * A horizontally scrollable timeline layout for news articles.
 * Desktop/Tablet: Side-by-side cards with a visual timeline below.
 * Mobile: Falls back to vertical stacked layout.
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

  // The scroll container ref, we'll need to manually scroll when clicking the buttons
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // The state of the buttons that do horizontal scrolling
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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
  const filteredItems = React.useMemo(() => {
    // No filtering if no category is selected
    if (!categoryFilter) return items

    // Otherwise filter by category
    return items.filter((item) => item.article.category === categoryFilter)
  }, [items, categoryFilter])

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

  // Check scroll position to update button states
  const updateScrollButtons = useCallback(() => {
    // Get the scroll container element
    const container = scrollContainerRef.current

    // Guard against a not set state?
    if (!container) return

    // The threshold for when the buttons should be enabled
    const threshold = 10

    // Get the scroll position and container dimensions
    const { scrollLeft, scrollWidth, clientWidth } = container

    // Update the button states based on the scroll position
    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - threshold)
  }, [])

  // Update scroll buttons on resize (cleanup handled automatically by Mantine)
  useWindowEvent('resize', updateScrollButtons)

  // Ensure scroll buttons have the right position when content changes
  useEffect(() => {
    updateScrollButtons()
  }, [updateScrollButtons, filteredItems.length])

  /** Function to scroll the container left or right */
  const scroll = (direction: 'left' | 'right') => {
    // Get the scroll container element
    const container = scrollContainerRef.current

    // Guard against a not set state?
    if (!container) return

    // Navigate to cards row → first card for precise width measurement
    const firstCard = container.querySelector('[data-cards-row]')?.firstElementChild as HTMLElement

    // Guard against no cards
    if (!firstCard) return

    // gap-6 = 1.5rem = 24px at default root font size
    const gapPx = 24
    const scrollAmount = firstCard.offsetWidth + gapPx

    // Calculate the new scroll position
    const newPosition =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    // Smoothly scroll to the new position
    container.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    })
  }

  /** Function to clear the category filter */
  const clearFilter = () => {
    // URL change will trigger a re-render cause we're parsing
    // the category from the URL
    router.push(ROUTES.NEWS)
  }

  /** Function to format a date for the timeline */
  const formatTimelineDate = (dateString: string) => {
    // Parse the date string into a Date object
    const date = new Date(dateString)

    // Format day + month with locale-aware ordering
    const dayMonth = format.dateTime(date, {
      day: 'numeric',
      month: 'numeric',
    })

    return {
      dayMonth,
      year: date.getFullYear().toString(),
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-full px-6">
      {/* Mobile Header - stacked layout */}
      <div className="md:hidden text-center flex flex-col gap-4">
        {/* Title with icon */}
        <div className="flex items-center justify-center gap-3">
          <Newspaper size={32} className="text-focus-light shrink-0" strokeWidth={1.5} />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        </div>

        {/* Mobile filter indicator */}
        {categoryFilter && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">{t('filtering')}</span>
            <button
              onClick={clearFilter}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md text-white',
                CATEGORY_COLORS[categoryFilter],
                'hover:opacity-80 transition-opacity'
              )}
            >
              {tCategories(categoryFilter)}
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Timeline Section - Desktop/Tablet only */}
      {filteredItems.length > 0 && (
        <CommentCountProvider targetType="News" targetIds={articleIds}>
          {/* MOBILE: Vertical stacked layout */}
          <div className="md:hidden flex flex-col gap-4">
            {filteredItems.map((item) => (
              <div key={item.article.id} className="flex flex-col gap-2">
                {item.card}
                <NewsCommentButton
                  articleId={item.article.id}
                  openComments={() => openComments(item.article)}
                />
              </div>
            ))}
          </div>

          {/* DESKTOP/TABLET: Horizontal timeline */}
          <div className="hidden md:block relative">
            {/* Header row with title in center */}
            <div className="flex items-center justify-center mb-12">
              {/* Center: Title + optional filter */}
              <div className="flex items-center gap-4">
                {/* Title with icon */}
                <div className="flex items-center gap-3">
                  <Newspaper size={36} className="text-focus-light shrink-0" strokeWidth={1.5} />
                  <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    {t('title')}
                  </h1>
                </div>

                {/* Filter indicator - appears next to title when active */}
                {categoryFilter && (
                  <>
                    <div className="w-px h-8 bg-foreground/10" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{t('filtering')}</span>
                      <button
                        onClick={clearFilter}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md text-white',
                          CATEGORY_COLORS[categoryFilter],
                          'hover:opacity-80 transition-opacity'
                        )}
                      >
                        {tCategories(categoryFilter)}
                        <X size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Scrollable container with cards AND timeline */}
            <div className="relative">
              {/* Navigation arrows on the timeline axis */}
              <TimelineNavButton
                direction="left"
                onClick={() => scroll('left')}
                visible={canScrollLeft}
              />
              <TimelineNavButton
                direction="right"
                onClick={() => scroll('right')}
                visible={canScrollRight}
              />

              <div
                ref={scrollContainerRef}
                onScroll={updateScrollButtons}
                className="overflow-x-auto"
                style={{
                  scrollBehavior: 'smooth',
                  scrollbarWidth: 'none', // Firefox
                  msOverflowStyle: 'none', // IE/Edge
                }}
              >
                {/* Hide scrollbar for Chrome/Safari */}
                <style jsx>{`
                  div::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>

                <div className="flex flex-col min-w-max">
                  {/* Cards row */}
                  <div data-cards-row className="flex gap-6">
                    {filteredItems.map((item) => {
                      return (
                        <div
                          key={item.article.id}
                          className="w-[340px] lg:w-[388px] flex-shrink-0 flex flex-col gap-2"
                        >
                          <div className="h-[200px] transition-all duration-300 hover:saturate-100">
                            {item.card}
                          </div>
                          <NewsCommentButton
                            articleId={item.article.id}
                            openComments={() => openComments(item.article)}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Timeline row - scrolls together with cards */}
                  <div className="relative mt-6 pt-4">
                    {/* Horizontal line spanning entire width - fade towards older */}
                    <div className="absolute top-4 left-0 right-0 h-[3px] bg-gradient-to-r from-focus-light via-focus/30 to-muted/10" />

                    {/* Date markers */}
                    <div className="flex gap-6">
                      {filteredItems.map((item, index) => {
                        // Parse the date info for the timeline
                        const dateInfo = formatTimelineDate(item.article.date)

                        // Check if this is the first item, it will be highlighted
                        const isFirst = index === 0

                        return (
                          <div
                            key={item.article.id}
                            className="w-[340px] lg:w-[388px] flex-shrink-0 flex flex-col items-center"
                          >
                            {/* Timeline dot with optional glow ring for newest */}
                            <div className="relative -mt-[6px] z-10">
                              {/* Animated glow ring for first/newest item */}
                              {isFirst && <div className="absolute inset-0 rounded-full" />}
                              {/* Dot - oldest dots get progressively darker borders */}
                              {(() => {
                                // Calculate border color - fades from indigo to dark slate
                                const borderOpacity = Math.max(20, 60 - index * 10)
                                const borderColor = isFirst
                                  ? // First item is styled with className, others with inline style
                                    undefined
                                  : `color-mix(in srgb, var(--color-focus) ${borderOpacity}%, transparent)`

                                return (
                                  <div
                                    className={cn(
                                      'w-4 h-4 rounded-full border-[3px]',
                                      isFirst
                                        ? 'bg-focus-light border-focus-light/50'
                                        : 'bg-background'
                                    )}
                                    style={isFirst ? undefined : { borderColor }}
                                  />
                                )
                              })()}
                            </div>

                            {/* Date info - also fades with age */}
                            <div
                              className="mt-4 text-center transition-opacity"
                              style={{ opacity: isFirst ? 1 : Math.max(0.5, 1 - index * 0.12) }}
                            >
                              <div
                                className={cn(
                                  'text-xl font-bold',
                                  isFirst ? 'text-focus-light' : 'text-muted'
                                )}
                              >
                                {dateInfo.dayMonth}
                              </div>
                              <div className="text-sm text-muted mt-1">{dateInfo.year}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
