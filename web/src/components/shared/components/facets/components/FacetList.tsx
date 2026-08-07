import type { KeyboardEvent, ReactNode, RefObject } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * The props of {@link FacetList}.
 */
type FacetListProps = {
  /** Id of the heading that names the list. */
  labelId: string
  /** The scrolling list element. */
  listRef: RefObject<HTMLDivElement | null>
  /** Handles the navigation keys. */
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  /** The option rows. */
  children: ReactNode
  /** Drops the list's top padding. */
  noTopPadding?: boolean
}

/**
 * The scrolling body of a facet's popover, holding its option rows.
 */
export function FacetList({
  labelId,
  listRef,
  onKeyDown,
  children,
  noTopPadding = false,
}: FacetListProps) {
  return (
    <div
      ref={listRef}
      className={cn(
        'max-h-[32vh] overflow-y-auto',
        noTopPadding ? 'px-0.5 sm:px-1 pb-0.5 sm:pb-1' : 'p-0.5 sm:p-1'
      )}
      role="group"
      aria-labelledby={labelId}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}
