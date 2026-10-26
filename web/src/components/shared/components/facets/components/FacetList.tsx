import { useTranslations } from 'next-intl'
import type { FocusEvent, ReactNode, RefObject } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'

/**
 * The props of {@link FacetList}.
 */
type FacetListProps = {
  /** How the rows inside are read: a flat set of options is a group, a hierarchy a tree. */
  role: 'group' | 'tree'
  /** Id of the heading that names the list. */
  labelId: string
  /** The scrolling list element. */
  listRef: RefObject<HTMLDivElement | null>
  /** Notes where focus lands among the rows. */
  onFocus: (event: FocusEvent<HTMLDivElement>) => void
  /** Notes focus leaving the rows. */
  onBlur: (event: FocusEvent<HTMLDivElement>) => void
  /** The option rows. */
  children: ReactNode
  /**
   * Whether the rows sit under section headings that stick to the top as the list scrolls. A heading stands flush in
   * place of the top padding, and a row the keys reach is brought into view clear of it rather than under it.
   */
  hasStickyHeadings?: boolean
}

/**
 * The scrolling body of a facet's popover, holding its option rows. It takes whatever height the panel has
 * left, so how tall a facet opens is decided by the popover's own sizing alone.
 *
 * Its scrollbar is forced to stay on screen: macOS hides overlay scrollbars at rest, so a list cut off at its
 * height gives no sign there is more of it under the last row on show.
 */
export function FacetList({
  role,
  labelId,
  listRef,
  onFocus,
  onBlur,
  children,
  hasStickyHeadings = false,
}: FacetListProps) {
  return (
    <div
      ref={listRef}
      className={cn(
        // Growing fills a panel taller than the rows and the zero floor lets it shrink into a shorter one.
        // The utility's transparent right border sits outside the bar rather than in place of the padding,
        // so the padding stays symmetric and the border is what holds the bar off the panel edge.
        'scrollbar-visible grow min-h-0 overflow-y-auto',
        // The scroll padding is as tall as a heading carrying its sort button, the most a stuck one covers
        hasStickyHeadings
          ? 'px-0.5 sm:px-1 pb-0.5 sm:pb-1 scroll-pt-9 sm:scroll-pt-11'
          : 'p-0.5 sm:p-1'
      )}
      role={role}
      aria-labelledby={labelId}
      onFocus={onFocus}
      onBlur={onBlur}
      // Firefox hands a scrolling box its own place in the tab order, which would put a stop on the list
      // itself in front of the row that is meant to carry one
      tabIndex={-1}
    >
      {children}
    </div>
  )
}

/**
 * Word that a facet's list has nothing to show.
 */
export function FacetNoResults() {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <div
      className="px-3 py-3 text-sm text-muted"
      // A press on the words leaves focus where it was
      onMouseDown={preventFocusLoss}
    >
      {tFilters('noResults')}
    </div>
  )
}
