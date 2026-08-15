import type { ReactNode, RefObject } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

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
  /** The option rows. */
  children: ReactNode
  /** Drops the list's top padding. */
  noTopPadding?: boolean
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
  children,
  noTopPadding = false,
}: FacetListProps) {
  return (
    <div
      ref={listRef}
      className={cn(
        // Growing fills a panel taller than the rows and the zero floor lets it shrink into a shorter one.
        // The utility's transparent right border sits outside the bar rather than in place of the padding,
        // so the padding stays symmetric and the border is what holds the bar off the panel edge.
        'scrollbar-visible grow min-h-0 overflow-y-auto',
        noTopPadding ? 'px-0.5 sm:px-1 pb-0.5 sm:pb-1' : 'p-0.5 sm:p-1'
      )}
      role={role}
      aria-labelledby={labelId}
      // Firefox hands a scrolling box its own place in the tab order, which would put a stop on the list
      // itself in front of the row that is meant to carry one
      tabIndex={-1}
    >
      {children}
    </div>
  )
}
