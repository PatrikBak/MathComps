'use client'

import { useWindowEvent } from '@mantine/hooks'
import { ChevronLeft, ChevronRight, Newspaper, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/constants/routes'

import { CATEGORY_CONFIG, type NewsArticle, type NewsCategory } from './types'

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
  if (!Object.keys(CATEGORY_CONFIG).includes(value)) return null

  // Return the category
  return value as NewsCategory
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
  // The navigation used to clear the category filter
  const router = useRouter()

  // Parse and validate the category filter from the URL
  const categoryFilter = parseCategory(useSearchParams().get('category'))

  // The scroll container ref, we'll need to manually scroll when clicking the buttons
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // The state of the buttons that do horizontal scrolling
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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

    // Scroll by roughly one card width + gap
    const scrollAmount = 400

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

    // Return the components. The month is formatted to be short
    // and without a period, e.g. Jan, Feb, Mar, etc.
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('sk-SK', { month: 'short' }).replace('.', ''),
      year: date.getFullYear().toString(),
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Mobile Header - stacked layout */}
      <div className="md:hidden text-center flex flex-col gap-4">
        {/* Title with icon */}
        <div className="flex items-center justify-center gap-3">
          <Newspaper size={32} className="text-indigo-400 shrink-0" strokeWidth={1.5} />
          <h1 className="text-3xl font-bold tracking-tight text-white">Novinky</h1>
        </div>

        {/* Mobile filter indicator */}
        {categoryFilter && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-400">Filtrujem:</span>
            <button
              onClick={clearFilter}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md',
                CATEGORY_CONFIG[categoryFilter].bgColor,
                CATEGORY_CONFIG[categoryFilter].textColor,
                'hover:opacity-80 transition-opacity'
              )}
            >
              {CATEGORY_CONFIG[categoryFilter].label}
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Timeline Section - Desktop/Tablet only */}
      {filteredItems.length > 0 && (
        <>
          {/* MOBILE: Vertical stacked layout */}
          <div className="md:hidden flex flex-col gap-4">
            {filteredItems.map((item) => (
              <div key={item.article.id}>{item.card}</div>
            ))}
          </div>

          {/* DESKTOP/TABLET: Horizontal timeline */}
          <div className="hidden md:block relative">
            {/* Navigation row with title in center */}
            <div className="flex items-center mb-12">
              {/* Left: Novšie (Newer) - fixed width to balance layout */}
              <button
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 shrink-0',
                  canScrollLeft
                    ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200'
                    : 'bg-slate-800/30 text-gray-600 cursor-not-allowed'
                )}
              >
                <ChevronLeft size={20} />
                <span>Novšie</span>
              </button>

              {/* Center: Title + optional filter - flex-1 prevents layout shift */}
              <div className="flex-1 flex items-center justify-center gap-4">
                {/* Title with icon */}
                <div className="flex items-center gap-3">
                  <Newspaper size={36} className="text-indigo-400 shrink-0" strokeWidth={1.5} />
                  <h1 className="text-4xl font-bold tracking-tight text-white">Novinky</h1>
                </div>

                {/* Filter indicator - appears next to title when active */}
                {categoryFilter && (
                  <>
                    <div className="w-px h-8 bg-gray-600/50" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Filtrujem:</span>
                      <button
                        onClick={clearFilter}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-md',
                          CATEGORY_CONFIG[categoryFilter].bgColor,
                          CATEGORY_CONFIG[categoryFilter].textColor,
                          'hover:opacity-80 transition-opacity'
                        )}
                      >
                        {CATEGORY_CONFIG[categoryFilter].label}
                        <X size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Staršie (Older) */}
              <button
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 shrink-0',
                  canScrollRight
                    ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200'
                    : 'bg-slate-800/30 text-gray-600 cursor-not-allowed'
                )}
              >
                <span>Staršie</span>
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Scrollable container with cards AND timeline */}
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
                <div className="flex gap-6">
                  {filteredItems.map((item) => (
                    <div
                      key={item.article.id}
                      className="w-[340px] lg:w-[388px] h-[200px] flex-shrink-0"
                    >
                      {item.card}
                    </div>
                  ))}
                </div>

                {/* Timeline row - scrolls together with cards */}
                <div className="relative mt-6 pt-4">
                  {/* Horizontal line spanning entire width */}
                  <div className="absolute top-4 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-indigo-400/50 to-indigo-500/20" />

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
                          className="w-[340px] lg:w-[380px] flex-shrink-0 flex flex-col items-center"
                        >
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              'w-4 h-4 rounded-full border-[3px] -mt-[6px] z-10',
                              isFirst
                                ? 'bg-indigo-400 border-indigo-200 shadow-lg shadow-indigo-500/60'
                                : 'bg-slate-800 border-indigo-500/60'
                            )}
                          />

                          {/* Date info */}
                          <div className="mt-4 text-center">
                            <div
                              className={cn(
                                'text-xl font-bold',
                                isFirst ? 'text-indigo-300' : 'text-gray-400'
                              )}
                            >
                              {dateInfo.day}. {dateInfo.month}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">{dateInfo.year}</div>
                          </div>

                          {/* "Najnovšie" label for first item */}
                          {isFirst && (
                            <div className="mt-3 px-3 py-1 bg-indigo-500/20 rounded-full text-xs font-semibold text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
                              Najnovšie
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
