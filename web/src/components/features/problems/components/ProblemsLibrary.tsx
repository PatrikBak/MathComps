'use client'

import { useDisclosure, useLocalStorage } from '@mantine/hooks'
import { useMemo } from 'react'
import { type Components, Virtuoso } from 'react-virtuoso'

import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { SHOW_TECHNIQUE_TAGS_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useAddressedChoice } from '@/hooks/use-addressed-choice'
import { useAddressedDisclosure } from '@/hooks/use-addressed-disclosure'

import { useCardFilterClicks } from '../hooks/use-card-filter-clicks'
import { usePendingProblemLike } from '../hooks/use-pending-problem-like'
import { usePendingProblemMark } from '../hooks/use-pending-problem-mark'
import { useProblemListScroll } from '../hooks/use-problem-list-scroll'
import { useProblemSearch } from '../hooks/use-problem-search'
import { PROBLEM_CARD_VIEW_CHOICE, URL_PARAMS } from '../utils/search-url-serialization'
import { ActiveFilterBar } from './ActiveFilterBar'
import { ConnectionStatePanel } from './ConnectionStatePanel'
import { EmptyResultsState } from './EmptyResultsState'
import { MobileFilterDrawer } from './MobileFilterDrawer'
import { PaginationFooter, type PaginationFooterState } from './PaginationFooter'
import { ProblemListItem } from './ProblemListItem'
import { LibraryColumns, LibraryFrame } from './ProblemsLibraryLayout'
import { ActiveFilterBarSkeleton, CardSkeletons, FilterSkeleton } from './ProblemsLibrarySkeletons'
import { ProblemSolutionDialog } from './ProblemSolutionDialog'
import { SearchFilters } from './SearchFilters'

/**
 * How far past the visible part of the list its cards are drawn ahead of time, in pixels, so a scroll finds them ready.
 */
const VIRTUOSO_INCREASE_VIEWPORT_BY = {
  top: 400,
  bottom: 600,
} as const

/**
 * The classes fading the results to half while the ones shown are the previous search's, held until the current search
 * answers.
 *
 * @param isHeld - Whether the results shown are the previous search's.
 * @returns The classes.
 */
function heldResultsClass(isHeld: boolean): string {
  // A short fade either way, to half while held
  return cn('transition-opacity duration-150', isHeld && 'opacity-50')
}

/**
 * The parts the list draws around its cards. They take their state from the list's context, so every render hands the
 * list the same components.
 */
const LIST_COMPONENTS: Components<string, PaginationFooterState> = {
  Footer: PaginationFooter,
}

/**
 * The problem library: the filters, the bar over the list saying what they narrow to, and the problems as an
 * endless list of cards.
 */
export default function ProblemsLibrary() {
  // The search the library shows, and the ways to change it and to recover it
  const {
    state: {
      isActiveSearchFetching,
      isBlankSlateLoading,
      isShowingPreviousSearch,
      isPaginationLoading,
      filters,
      answeredFilters,
      filterOptions,
      baseOptions,
      problems,
      totalCount,
      hasMore,
      pageState,
      searchState,
      listName,
    },
    handleFiltersChange,
    retryPage,
    retrySearch,
    loadMore,
  } = useProblemSearch()

  // Whether the reader wants technique tags on every card, kept in the local storage
  const [showTechniqueTags, setShowTechniqueTags] = useLocalStorage({
    key: SHOW_TECHNIQUE_TAGS_STORAGE_KEY,
    defaultValue: false,
  })

  // How the reader wants the cards drawn, carried in the URL so a reload or a copied address keeps it
  const { option: cardView, choose: setCardView } = useAddressedChoice(PROBLEM_CARD_VIEW_CHOICE)

  // The problem whose solution is open, and the ways to open and close it, carried in the URL so a copied address
  // opens it again
  const openedSolution = useAddressedDisclosure(URL_PARAMS.OPEN_SOLUTION)

  // Whether the filter drawer is open, and the ways to open and close it, for a viewport with no room for the sidebar
  const [isMobileFilterOpen, mobileFilter] = useDisclosure(false)

  // The like a reader asked for before signing in, applied once they have
  usePendingProblemLike()

  // The mark a reader asked for before signing in, applied once they have
  usePendingProblemMark()

  // What a card's clicks do to the filters
  const { toggleTag, toggleAuthor, showList } = useCardFilterClicks({
    filters,
    onFiltersChange: handleFiltersChange,
  })

  // The slugs of the tags filtered on
  const selectedTagSlugs = useMemo(
    () => new Set(filters?.tags.map((tag) => tag.slug) ?? []),
    [filters?.tags]
  )

  // The slugs of the authors filtered on
  const selectedAuthorSlugs = useMemo(
    () => new Set(filters?.authors.map((author) => author.slug) ?? []),
    [filters?.authors]
  )

  // The slugs of the tags filtered on that the current options offer, which show on a card even while techniques
  // are hidden
  const activeTechniqueFilterSlugs = useMemo(
    () =>
      new Set(
        filters?.tags
          .filter((tag) => filterOptions?.tags.some((tagOption) => tagOption.slug === tag.slug))
          .map((tag) => tag.slug) ?? []
      ),
    [filters?.tags, filterOptions?.tags]
  )

  // Whether another page may be fetched now: there is one, and nothing is on its way already
  const canLoadMore = hasMore && !isPaginationLoading && !isActiveSearchFetching

  // Where the list starts, how its edges fade, and when it asks for the next page
  const listScroll = useProblemListScroll({
    filters,
    isShowingPreviousSearch,
    problemCount: problems.length,
    canLoadMore,
    loadMore,
  })

  // Whether the page can be drawn at all comes down to the state of the fetch it is built on
  switch (pageState.kind) {
    // Nothing to draw, and the connection is why. A retry in flight lands here too, which is the
    // one place a spinner is telling the truth.
    case 'failed':
    case 'offline':
    case 'retrying':
      return (
        <LibraryFrame>
          <ConnectionStatePanel state={pageState} onRetry={retryPage} />
        </LibraryFrame>
      )

    // Still on its way, so hold the shape with skeletons
    case 'loading':
      return (
        <LibraryFrame>
          <LibraryColumns
            sidebar={<FilterSkeleton />}
            bar={<ActiveFilterBarSkeleton />}
            list={<CardSkeletons view={cardView} />}
          />
        </LibraryFrame>
      )

    // The fetch is settled, so the library itself is what renders, below
    case 'ready':
      break

    // Every state is handled above
    default:
      return assertNever(pageState)
  }

  // The fetch is settled by the time this is read (the switch above returns for every other state),
  // so what is left to check is whether the data derived from it is here. Before that, skeletons.
  const isPageReady = filters !== null && filterOptions !== null

  // What the end of the list reports
  const footerState: PaginationFooterState = {
    isLoading: isPaginationLoading,
    searchState,
    hasMore,
  }

  // The list: skeletons until the problems are here, the cards once they are, or, when there are none, why and the way
  // out
  const list =
    !isPageReady || isBlankSlateLoading ? (
      <CardSkeletons view={cardView} />
    ) : problems.length > 0 ? (
      <Virtuoso
        ref={listScroll.virtuosoRef}
        data={problems}
        context={footerState}
        components={LIST_COMPONENTS}
        // Each row known by its problem, so a recycled row never shows another problem's card
        computeItemKey={(_index, problemSlug) => problemSlug}
        className={cn('h-full', heldResultsClass(isShowingPreviousSearch))}
        scrollerRef={listScroll.attachScroller}
        style={listScroll.maskStyle}
        increaseViewportBy={VIRTUOSO_INCREASE_VIEWPORT_BY}
        endReached={listScroll.handleEndReached}
        rangeChanged={listScroll.handleRangeChanged}
        itemContent={(index, problemSlug) => (
          <ProblemListItem
            problemSlug={problemSlug}
            ordinalNumber={index + 1}
            view={cardView}
            areTechniquesGloballyVisible={showTechniqueTags}
            onTagClick={toggleTag}
            selectedTagSlugs={selectedTagSlugs}
            activeTechniqueFilterSlugs={activeTechniqueFilterSlugs}
            onAuthorClick={toggleAuthor}
            selectedAuthorSlugs={selectedAuthorSlugs}
            onSelectList={showList}
            onOpenSolution={openedSolution.open}
          />
        )}
      />
    ) : (
      // In line with the cards, which keep the same room at their right
      <div className={cn('pr-2', heldResultsClass(isShowingPreviousSearch))}>
        <EmptyResultsState
          searchState={searchState}
          onRetry={retrySearch}
          // The filters the empty answer on screen ran under, which trail the ones just picked until those answer
          filters={answeredFilters ?? filters}
          onFiltersChange={handleFiltersChange}
        />
      </div>
    )

  return (
    <LibraryFrame>
      {/* The filters beside the problems */}
      <LibraryColumns
        sidebar={
          isPageReady ? (
            <SearchFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              filterOptions={filterOptions}
              baseOptions={baseOptions ?? filterOptions}
              sharedListName={listName}
              // The sidebar stands on the page itself
              standsOn="page"
            />
          ) : (
            <FilterSkeleton />
          )
        }
        bar={
          isPageReady ? (
            <ActiveFilterBar
              filters={filters}
              filterOptions={filterOptions}
              baseOptions={baseOptions ?? filterOptions}
              onFiltersChange={handleFiltersChange}
              problemCount={totalCount}
              showTechniqueTags={showTechniqueTags}
              onShowTechniqueTagsChange={setShowTechniqueTags}
              cardView={cardView}
              onCardViewChange={setCardView}
              onMobileFilterClick={mobileFilter.open}
              isSearching={isActiveSearchFetching}
            />
          ) : (
            <ActiveFilterBarSkeleton />
          )
        }
        list={list}
      />

      {/* The filters as a drawer, for a viewport with no room for the sidebar */}
      {isPageReady && (
        <MobileFilterDrawer
          isOpen={isMobileFilterOpen}
          onClose={mobileFilter.close}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          filterOptions={filterOptions}
          baseOptions={baseOptions ?? filterOptions}
          sharedListName={listName}
        />
      )}

      {/* The open solution, over the list */}
      {openedSolution.openedValue !== null && (
        <ProblemSolutionDialog
          problemSlug={openedSolution.openedValue}
          onClose={openedSolution.close}
        />
      )}
    </LibraryFrame>
  )
}
