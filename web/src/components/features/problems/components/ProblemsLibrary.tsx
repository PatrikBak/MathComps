'use client'

import { useLocalStorage } from '@mantine/hooks'
import { Loader2, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'

import { ProblemCardSkeleton } from '@/components/features/problems/components/ProblemCardSkeleton'
import { PREFETCH_THRESHOLD } from '@/components/features/problems/constants/pagination-constants'
import { VIRTUOSO_INCREASE_VIEWPORT_BY } from '@/components/features/problems/constants/problem-list-constants'
import { isExclusiveSelection } from '@/components/shared/utils/event-utils'
import { SHOW_TECHNIQUE_TAGS_STORAGE_KEY } from '@/constants/local-storage-constants'

import { usePendingProblemLike } from '../hooks/use-pending-problem-like'
import { usePendingProblemMark } from '../hooks/use-pending-problem-mark'
import { useProblemSearch } from '../hooks/use-problem-search'
import { countActiveFilters } from '../utils/filter-validation'
import ActiveFiltersBar from './ActiveFilterBar'
import { AnimatedProblemCard } from './AnimatedProblemCard'
import { EmptyState } from './EmptyState'
import { MobileFilterDrawer } from './MobileFilterDrawer'
import { SearchFilters } from './SearchFilters'

const ActiveFiltersBarSkeleton = () => (
  <div className="flex animate-pulse items-center justify-between">
    <div className="h-5 w-48 rounded-md bg-foreground/10"></div>
    <div className="h-5 w-24 rounded-md bg-foreground/10"></div>
  </div>
)

const FilterSkeleton = () => (
  <div className="flex flex-col space-y-4 animate-pulse">
    <div className="h-8 w-32 bg-foreground/10 rounded" />
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className="h-6 w-64 bg-foreground/10 rounded" />
    ))}
  </div>
)

export default function ProblemsLibrary() {
  // Translations for section
  const t = useTranslations('problems')

  // The hook to handle all difficult logic of problem search
  const {
    state: {
      isPageLoading,
      isActiveSearchFetching,
      isBlankSlateLoading,
      isPaginationLoading,
      filters,
      filterOptions,
      baseOptions,
      problems,
      totalCount,
      hasMore,
      error,
      hasInitialDataLoaded,
      listName,
    },
    handleFiltersChange,
    loadMore,
  } = useProblemSearch()

  // In the local storage, we'll store whether the user wants to see technique tags
  const [showTechniqueTags, setShowTechniqueTags] = useLocalStorage({
    key: SHOW_TECHNIQUE_TAGS_STORAGE_KEY,
    defaultValue: false,
  })

  // State for mobile filter drawer
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // Handle pending problem likes after user authentication
  usePendingProblemLike()

  // Handle pending problem marks after user authentication
  usePendingProblemMark()

  // We'll track whether we have the needed data. Before that, we show skeletons
  const isPageReady = !isPageLoading && filters && filterOptions && hasInitialDataLoaded

  // Create a set of selected tag slugs for efficient lookup
  const selectedTagSlugs = useMemo(
    () => new Set(filters?.tags.map((tag) => tag.slug) ?? []),
    [filters?.tags]
  )

  // Create a set of selected author slugs for efficient lookup
  const selectedAuthorSlugs = useMemo(
    () => new Set(filters?.authors.map((author) => author.slug) ?? []),
    [filters?.authors]
  )

  // Create a set of selected technique tag slugs for efficient lookup in ProblemCard
  const activeTechniqueFilterSlugs = useMemo(
    () =>
      new Set(
        filters?.tags
          .filter((tag) => filterOptions?.tags.find((tagOption) => tagOption.slug === tag.slug))
          .map((tag) => tag.slug) ?? []
      ),
    [filters?.tags, filterOptions?.tags]
  )

  // Handle tag clicks to toggle them in filters
  const handleTagClick = (tag: { displayName: string; slug: string }, event: React.MouseEvent) => {
    if (!filters) return

    // Ctrl/Cmd+Click: exclusive selection (keep only this tag)
    if (isExclusiveSelection(event)) {
      handleFiltersChange({ ...filters, tags: [tag] })
      return
    }

    // Check if the tag is already selected
    const isTagAlreadySelected = filters.tags.some((existingTag) => existingTag.slug === tag.slug)

    // Update the filters
    handleFiltersChange({
      ...filters,
      tags: isTagAlreadySelected
        ? // Remove the tag if it's already selected
          filters.tags.filter((existingTag) => existingTag.slug !== tag.slug)
        : // Add the tag if it's not selected
          [...filters.tags, tag],
    })
  }

  // Handle author clicks to toggle them in filters
  const handleAuthorClick = (
    author: { displayName: string; slug: string },
    event: React.MouseEvent
  ) => {
    if (!filters) return

    // Ctrl/Cmd+Click: exclusive selection (keep only this author)
    if (isExclusiveSelection(event)) {
      handleFiltersChange({ ...filters, authors: [author] })
      return
    }

    // Check if the author is already selected
    const isAuthorAlreadySelected = filters.authors.some(
      (existingAuthor) => existingAuthor.slug === author.slug
    )

    // Update the filters
    handleFiltersChange({
      ...filters,
      authors: isAuthorAlreadySelected
        ? // Remove the author if it's already selected
          filters.authors.filter((existingAuthor) => existingAuthor.slug !== author.slug)
        : // Add the author if it's not selected
          [...filters.authors, author],
    })
  }

  // Handle selecting a list from the Manage Lists modal (navigates to filtered view)
  const handleSelectList = useCallback(
    (contentId: string) => {
      if (!filters) return
      handleFiltersChange({ ...filters, favoritesOnly: false, listContentId: contentId })
    },
    [filters, handleFiltersChange]
  )

  // Animation state management
  const [searchBatchId, setSearchBatchId] = useState(0)
  const previousIsSearchingInBackground = React.useRef(isActiveSearchFetching)
  const isInitialLoadRef = React.useRef(true)

  // Track visible range for viewport animations
  const [, setVisibleRange] = useState<{ startIndex: number; endIndex: number }>({
    startIndex: 0,
    endIndex: 0,
  })

  // Track scroll direction - only animate when scrolling down
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)
  const lastScrollTopRef = React.useRef(0)

  // Detect when initial search completes to trigger batch animations
  // Only runs once on initial load, not on filter changes
  useEffect(() => {
    // Detect transition from searching → not searching
    // prevIsSearchingRef ensures we only trigger on the transition, not on initial mount
    const searchJustCompleted = previousIsSearchingInBackground.current && !isActiveSearchFetching

    // If initial load completed...
    if (searchJustCompleted && !isPaginationLoading && isInitialLoadRef.current) {
      // This should trigger animation
      setSearchBatchId((prev) => prev + 1)

      // We will not trigger it again
      isInitialLoadRef.current = false
    }

    // Track current searching state for next render
    previousIsSearchingInBackground.current = isActiveSearchFetching
  }, [isActiveSearchFetching, isPaginationLoading, problems.length])

  // Scroll to top when problems set changes (new search), but not during infinite scroll
  useEffect(() => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollTo({ top: 0 })
    }
  }, [filters])

  // Virtuoso will handle the infinite scrolling; we prefetch when close to the end
  const virtuosoRef = React.useRef<VirtuosoHandle | null>(null)

  // Detect scroll direction
  const handleScroll = React.useCallback((e: Event) => {
    const target = e.target as HTMLElement
    if (target) {
      const currentScrollTop = target.scrollTop
      const lastScrollTop = lastScrollTopRef.current

      if (currentScrollTop > lastScrollTop) {
        setScrollDirection('down')
      } else if (currentScrollTop < lastScrollTop) {
        setScrollDirection('up')
      }

      lastScrollTopRef.current = currentScrollTop
    }
  }, [])

  // Handle critical initial load failures - only show error if we have no data at all
  if (error && !hasInitialDataLoaded) {
    return (
      <div className="fixed inset-0 text-muted-foreground">
        <div className="flex h-full flex-col">
          <div className="h-14 sm:h-16 lg:h-20 flex-shrink-0" />
          <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden p-2 sm:p-3 lg:p-8">
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <WifiOff className="mx-auto mb-4 h-16 w-16 text-error/60" />
                <h2 className="mb-2 text-2xl font-bold text-foreground">{t('connectionFailed')}</h2>
                <div className="flex items-center justify-center gap-3 text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t('tryingToConnect')}</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Early return to prevent rendering issues during loading
  if (isPageLoading) {
    return (
      <div className="fixed inset-0 text-muted-foreground">
        <div className="flex h-full flex-col">
          <div className="h-14 sm:h-16 lg:h-20 flex-shrink-0" />
          <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden p-2 sm:p-3 lg:p-8">
            <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-[var(--problems-sidebar-width)_1fr]">
              <aside className="hidden h-full flex-col overflow-y-auto shadow-lg lg:flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <FilterSkeleton />
              </aside>
              <div className="flex flex-col overflow-hidden">
                <div className="mb-2 sm:mb-4 lg:mb-6 flex-shrink-0">
                  <ActiveFiltersBarSkeleton />
                </div>
                <div className="relative flex-1 overflow-y-auto">
                  <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                    <div className="py-2 sm:py-3 lg:py-4 first:pt-0 pr-2">
                      <ProblemCardSkeleton />
                    </div>
                    <div className="py-2 sm:py-3 lg:py-4 first:pt-0 pr-2">
                      <ProblemCardSkeleton />
                    </div>
                  </div>
                </div>
                <div className="flex h-3 sm:h-4 lg:h-6 flex-shrink-0 items-end justify-center">
                  <div className="h-1 w-8 rounded-full bg-foreground/10" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 text-muted-foreground">
      <div className="flex h-full flex-col">
        <div className="h-14 sm:h-16 lg:h-20 flex-shrink-0" />
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden p-2 sm:p-3 lg:p-8">
          <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-[var(--problems-sidebar-width)_1fr]">
            {/* Left Column: Filters */}
            <aside className="hidden h-full flex-col overflow-y-auto shadow-lg lg:flex [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {isPageReady ? (
                <SearchFilters
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  filterOptions={filterOptions}
                  baseOptions={baseOptions ?? filterOptions}
                  sharedListName={listName}
                />
              ) : (
                <FilterSkeleton />
              )}
            </aside>

            {/* Right Column: Content */}
            <div className="flex flex-col overflow-hidden">
              {/* ActiveFiltersBar  */}
              <div className="mb-2 sm:mb-4 lg:mb-6 flex-shrink-0">
                {isPageReady ? (
                  <ActiveFiltersBar
                    filters={filters}
                    filterOptions={filterOptions}
                    baseOptions={baseOptions ?? filterOptions}
                    onFiltersChange={handleFiltersChange}
                    problemCount={totalCount}
                    showTechniqueTags={showTechniqueTags}
                    onShowTechniqueTagsChange={setShowTechniqueTags}
                    onMobileFilterClick={() => setIsMobileFilterOpen(true)}
                    isSearching={isActiveSearchFetching}
                  />
                ) : (
                  <ActiveFiltersBarSkeleton />
                )}
              </div>

              {/* The problem list container */}
              <div className="relative flex-1 overflow-hidden">
                {!isPageReady || isBlankSlateLoading ? (
                  <div className="h-full">
                    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                      <div className="py-2 sm:py-3 lg:py-4 first:pt-0 pr-2">
                        <ProblemCardSkeleton />
                      </div>
                      <div className="py-2 sm:py-3 lg:py-4 first:pt-0 pr-2">
                        <ProblemCardSkeleton />
                      </div>
                    </div>
                  </div>
                ) : problems.length > 0 ? (
                  <Virtuoso
                    ref={virtuosoRef}
                    data={problems}
                    className="h-full"
                    increaseViewportBy={VIRTUOSO_INCREASE_VIEWPORT_BY}
                    scrollerRef={(ref) => {
                      if (ref) {
                        ref.addEventListener('scroll', handleScroll)
                        return () => ref.removeEventListener('scroll', handleScroll)
                      }
                    }}
                    endReached={() => {
                      if (hasMore && !isPaginationLoading && !isActiveSearchFetching) {
                        loadMore()
                      }
                    }}
                    itemContent={(index, problemSlug) => (
                      <AnimatedProblemCard
                        key={problemSlug}
                        problemSlug={problemSlug}
                        ordinalNumber={index + 1}
                        index={index}
                        isNewBatch={searchBatchId > 0}
                        scrollDirection={scrollDirection}
                        isInitialLoad={isInitialLoadRef.current}
                        areTechniquesGloballyVisible={showTechniqueTags}
                        onTagClick={handleTagClick}
                        selectedTagSlugs={selectedTagSlugs}
                        activeTechniqueFilterSlugs={activeTechniqueFilterSlugs}
                        onAuthorClick={handleAuthorClick}
                        selectedAuthorSlugs={selectedAuthorSlugs}
                        onSelectList={handleSelectList}
                      />
                    )}
                    rangeChanged={({ startIndex, endIndex }) => {
                      // Update visible range for animations
                      setVisibleRange({ startIndex, endIndex })

                      // Early prefetch when within PREFETCH_THRESHOLD from the end
                      if (
                        hasMore &&
                        !isPaginationLoading &&
                        !isActiveSearchFetching &&
                        problems.length - endIndex <= PREFETCH_THRESHOLD
                      ) {
                        loadMore()
                      }
                    }}
                    components={{
                      Footer: () =>
                        isPaginationLoading ? (
                          <div className="py-4 sm:py-6 lg:py-8 flex justify-center">
                            <div className="flex items-center gap-3 text-muted">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="text-sm">{t('loadingMore')}</span>
                            </div>
                          </div>
                        ) : null,
                    }}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>

              {/* End of List Anchor (No Changes) */}
              <div className="flex h-3 sm:h-4 lg:h-6 flex-shrink-0 items-end justify-center">
                <div className="h-1 w-8 rounded-full bg-foreground/10" />
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Filter Drawer */}
        {isPageReady && (
          <MobileFilterDrawer
            isOpen={isMobileFilterOpen}
            onClose={() => setIsMobileFilterOpen(false)}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            filterOptions={filterOptions}
            baseOptions={baseOptions ?? filterOptions}
            activeFilterCount={countActiveFilters(filters)}
            sharedListName={listName}
          />
        )}
      </div>
    </div>
  )
}
