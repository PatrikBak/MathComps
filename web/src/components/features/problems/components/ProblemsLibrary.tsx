'use client'

import { useLocalStorage } from '@mantine/hooks'
import { Loader2, WifiOff } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import { Virtuoso } from 'react-virtuoso'
import { toast } from 'sonner'

import { ProblemCardSkeleton } from '@/components/features/problems/components/ProblemCardSkeleton'
import { ACTIVE_FILTERS_CONSTANTS } from '@/components/features/problems/constants/filter-constants'
import { PREFETCH_THRESHOLD } from '@/components/features/problems/constants/pagination-constants'
import { VIRTUOSO_INCREASE_VIEWPORT_BY } from '@/components/features/problems/constants/problem-list-constants'

import { useProblemSearch } from '../hooks/use-problem-search'
import { countActiveFilters } from '../utils/filter-validation'
import ActiveFiltersBar from './ActiveFilterBar'
import { AnimatedProblemCard } from './AnimatedProblemCard'
import { EmptyState } from './EmptyState'
import FilterSkeleton from './FilterSkeleton'
import { MobileFilterDrawer } from './MobileFilterDrawer'
import { SearchFilters } from './SearchFilters'

const ActiveFiltersBarSkeleton = () => (
  <div className="flex animate-pulse items-center justify-between">
    <div className="h-5 w-48 rounded-md bg-gray-700"></div>
    <div className="h-5 w-24 rounded-md bg-gray-700"></div>
  </div>
)

export default function ProblemsLibrary() {
  const { state, handleFiltersChange: handleFiltersChangeInternal, loadMore } = useProblemSearch()
  const {
    isLoading,
    isSearching,
    isLoadingMore,
    filters,
    initialFilters,
    filterOptions,
    baseOptions,
    problems,
    totalCount,
    hasMore,
    error,
    hasInitialDataLoaded,
    isOfflineMode,
  } = state

  // Wrap filter change handler with validation to prevent excessive URL length
  const handleFiltersChange = useCallback(
    (newFilters: Parameters<typeof handleFiltersChangeInternal>[0]) => {
      // Count total active filters in the new filter state
      const filterCount = countActiveFilters(newFilters)

      // Enforce maximum filter limit to prevent URL overflow and maintain performance
      if (filterCount > ACTIVE_FILTERS_CONSTANTS.maxFilterLimit) {
        toast.warning(`Môžete vybrať maximálne ${ACTIVE_FILTERS_CONSTANTS.maxFilterLimit} filtrov`)
        return
      }

      // All validation passed, apply the filter changes
      handleFiltersChangeInternal(newFilters)
    },
    [handleFiltersChangeInternal]
  )

  const [showTechniqueTags, setShowTechniqueTags] = useLocalStorage({
    key: 'showTechniqueTags',
    defaultValue: false,
  })
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // Keep filters visible during search to maintain user context
  // Only hide filters during initial loading or when critical data is missing
  // On initial load, wait for both filters AND problem data before showing the real bar
  // Also prevent flicker when transitioning from single problem to search mode
  const isPageReady =
    !isLoading && filters && filterOptions && initialFilters && hasInitialDataLoaded

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
  const handleTagClick = (tag: { displayName: string; slug: string }) => {
    if (!filters) return

    // Check if tag is already in filters
    const isTagAlreadySelected = filters.tags.some((existingTag) => existingTag.slug === tag.slug)

    const newFilters = {
      ...filters,
      tags: isTagAlreadySelected
        ? // Remove the tag if it's already selected
          filters.tags.filter((existingTag) => existingTag.slug !== tag.slug)
        : // Add the tag if it's not selected
          [...filters.tags, tag],
    }

    handleFiltersChange(newFilters)
  }

  // Handle author clicks to toggle them in filters
  const handleAuthorClick = (author: { displayName: string; slug: string }) => {
    if (!filters) return

    // Check if author is already in filters
    const isAuthorAlreadySelected = filters.authors.some(
      (existingAuthor) => existingAuthor.slug === author.slug
    )

    const newFilters = {
      ...filters,
      authors: isAuthorAlreadySelected
        ? // Remove the author if it's already selected
          filters.authors.filter((existingAuthor) => existingAuthor.slug !== author.slug)
        : // Add the author if it's not selected
          [...filters.authors, author],
    }

    handleFiltersChange(newFilters)
  }

  // Animation state management
  const [searchBatchId, setSearchBatchId] = useState(0)
  const prevIsSearchingRef = React.useRef(isSearching)
  const isInitialLoadRef = React.useRef(true)

  // Track visible range for viewport animations
  const [, setVisibleRange] = useState<{ startIndex: number; endIndex: number }>({
    startIndex: 0,
    endIndex: 0,
  })

  // Track scroll direction - only animate when scrolling down
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null)
  const lastScrollTopRef = React.useRef(0)

  // Detect when search completes to trigger batch animations and scroll
  useEffect(() => {
    const wasSearching = prevIsSearchingRef.current
    const searchJustCompleted = wasSearching && !isSearching

    if (searchJustCompleted && !isLoadingMore) {
      // Trigger batch animation when search completes (not infinite scroll)
      setSearchBatchId((prev) => prev + 1)
      isInitialLoadRef.current = false
    }

    prevIsSearchingRef.current = isSearching
  }, [isSearching, isLoadingMore, isOfflineMode, problems.length])

  // Scroll to top when problems set changes (new search), but not during infinite scroll
  useEffect(() => {
    if (!isLoadingMore && virtuosoRef.current) {
      virtuosoRef.current.scrollTo({ top: 0 })
    }
  }, [isLoadingMore, problems])

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
      <div className="fixed inset-0 text-gray-300">
        <div className="flex h-full flex-col">
          <div className="h-14 sm:h-16 lg:h-20 flex-shrink-0" />
          <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden p-2 sm:p-3 lg:p-8">
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <WifiOff className="mx-auto mb-4 h-16 w-16 text-red-400/60" />
                <h2 className="mb-2 text-2xl font-bold text-white">Pripojenie zlyhalo</h2>
                <div className="flex items-center justify-center gap-3 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Pokúšam sa pripojiť...</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Early return to prevent rendering issues during loading
  if (isLoading) {
    return (
      <div className="fixed inset-0 text-gray-300">
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
                  <div className="h-1 w-8 rounded-full bg-gray-700" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 text-gray-300">
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
                    initialFilters={initialFilters}
                    onFiltersChange={handleFiltersChange}
                    problemCount={totalCount}
                    showTechniqueTags={showTechniqueTags}
                    onShowTagsChange={setShowTechniqueTags}
                    onMobileFilterClick={() => setIsMobileFilterOpen(true)}
                    isSearching={isSearching}
                  />
                ) : (
                  <ActiveFiltersBarSkeleton />
                )}
              </div>

              {/* The problem list container */}
              <div className="relative flex-1 overflow-hidden">
                {!isPageReady || isSearching ? (
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
                  <>
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
                        if (hasMore && !isLoadingMore && !isSearching) {
                          loadMore()
                        }
                      }}
                      itemContent={(index, problem) => (
                        <AnimatedProblemCard
                          key={problem.slug}
                          problem={problem}
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
                        />
                      )}
                      rangeChanged={({ startIndex, endIndex }) => {
                        // Update visible range for animations
                        setVisibleRange({ startIndex, endIndex })

                        // Early prefetch when within PREFETCH_THRESHOLD from the end
                        if (
                          hasMore &&
                          !isLoadingMore &&
                          !isSearching &&
                          problems.length - endIndex <= PREFETCH_THRESHOLD
                        ) {
                          loadMore()
                        }
                      }}
                      components={{
                        Footer: () =>
                          isLoadingMore ? (
                            <div className="py-4 sm:py-6 lg:py-8 flex justify-center">
                              <div className="flex items-center gap-3 text-gray-400">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm">Načítavam ďalšie úlohy...</span>
                              </div>
                            </div>
                          ) : null,
                      }}
                    />
                  </>
                ) : (
                  <EmptyState />
                )}
              </div>

              {/* End of List Anchor (No Changes) */}
              <div className="flex h-3 sm:h-4 lg:h-6 flex-shrink-0 items-end justify-center">
                <div className="h-1 w-8 rounded-full bg-gray-700" />
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
            activeFilterCount={filters ? countActiveFilters(filters) : 0}
          />
        )}
      </div>
    </div>
  )
}
