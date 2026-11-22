import { type CSSProperties, type RefObject, useEffect, useRef } from 'react'
import type { ListRange, VirtuosoHandle } from 'react-virtuoso'

import { useScrollFade } from '@/hooks/use-scroll-fade'

import { PREFETCH_THRESHOLD } from '../constants/pagination-constants'
import type { SearchFiltersState } from '../types/problem-library-types'

/**
 * The options of {@link useProblemListScroll}.
 */
type UseProblemListScrollOptions = {
  /** The filters the list shows the problems of. */
  filters: SearchFiltersState | null
  /** Whether the problems shown are an earlier search's, held on screen while the current one is on its way. */
  isShowingPreviousSearch: boolean
  /** How many problems the list holds. */
  problemCount: number
  /** Whether another page of problems can be fetched now. */
  canLoadMore: boolean
  /** Fetches the next page of problems. */
  loadMore: () => void
}

/**
 * The list of problems' scrolling: where it starts, how its edges fade, and when it asks for the next page.
 */
type UseProblemListScrollResult = {
  /** The list, as the handle it is rendered with. */
  virtuosoRef: RefObject<VirtuosoHandle | null>
  /** Hands the list's scroller over, as the list reports it. */
  attachScroller: (scroller: HTMLElement | Window | null) => void
  /** The mask fading whichever edge of the list hides problems, or undefined while neither does. */
  maskStyle: CSSProperties | undefined
  /** Fetches the next page once the reader reaches the end of the list. */
  handleEndReached: () => void
  /** Fetches the next page early, once the reader is a few problems from the end. */
  handleRangeChanged: (range: ListRange) => void
}

/**
 * The list of problems' scrolling. The list starts from its top whenever the filters change, and again once the
 * search for them answers, since the answer held until then may have been scrolled. Its edges fade while they hide
 * problems, and nearing the end asks for the next page.
 *
 * @param options - The filters and the search answering them, and the way to fetch more.
 * @returns The list's handle and scroller, its mask, and the handlers asking for more.
 */
export function useProblemListScroll({
  filters,
  isShowingPreviousSearch,
  problemCount,
  canLoadMore,
  loadMore,
}: UseProblemListScrollOptions): UseProblemListScrollResult {
  // The list's handle
  const virtuosoRef = useRef<VirtuosoHandle | null>(null)

  // A function which hands the fade the list's scroller element, and the mask fading whichever of its edges hides
  // problems
  const { ref: attachScrollElement, maskStyle } = useScrollFade<HTMLElement>('y')

  // New filters start the list from its top, and so does the answer replacing the one held while they were sent
  useEffect(() => {
    virtuosoRef.current?.scrollTo({ top: 0 })
  }, [filters, isShowingPreviousSearch])

  // A function which hands the list's scroller to the fade, the window never being it, since the list scrolls itself
  const attachScroller = (scroller: HTMLElement | Window | null) =>
    attachScrollElement(scroller instanceof HTMLElement ? scroller : null)

  // A function which fetches the next page once the reader reaches the end of the list
  const handleEndReached = () => {
    // Only while there is a page to fetch and nothing on its way
    if (canLoadMore) loadMore()
  }

  // A function which fetches the next page early, once the reader is a few problems from the end
  const handleRangeChanged = ({ endIndex }: ListRange) => {
    // Only within reach of the end, and while there is a page to fetch and nothing on its way
    if (canLoadMore && problemCount - endIndex <= PREFETCH_THRESHOLD) loadMore()
  }

  // The list's handle and scroller, its mask, and the handlers asking for more
  return { virtuosoRef, attachScroller, maskStyle, handleEndReached, handleRangeChanged }
}
