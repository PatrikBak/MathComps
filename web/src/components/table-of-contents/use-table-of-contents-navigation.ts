import { useMemo } from 'react'

import { useCustomScrollSpy } from '@/hooks/use-custom-scroll-spy'
import { useScrollOffset } from '@/hooks/use-scroll-offset'

import type { TableOfContentsItem } from './table-of-contents-types'

/**
 * Options for the table of contents navigation hook.
 */
type UseTableOfContentsNavigationOptions = {
  /** The navigation items. */
  items: TableOfContentsItem[]
}

/**
 * A hook providing table-of-contents navigation: scroll-spy tracking and navigation clicks.
 */
export function useTableOfContentsNavigation({ items }: UseTableOfContentsNavigationOptions) {
  // The sections' anchor ids, the same array across renders
  const itemIds = useMemo(() => items.map((item) => item.id), [items])

  // Track the active section via scroll-spy, offset to clear the sticky header
  const { activeIndex, selectItem } = useCustomScrollSpy({
    itemIds,
    offset: useScrollOffset(),
  })

  /**
   * Navigates to a section by ID with smooth scrolling and URL history update.
   *
   * @param id - The section ID to navigate to
   */
  const handleNavigationClick = (id: string) => {
    // Find the element with the matching ID
    const element = document.getElementById(id)

    // If the element exists...
    if (element) {
      // Update URL hash for deep-linking support
      window.history.pushState(null, '', `#${id}`)

      // Mark the section as the reader's pick, which wins at the bottom of the page where its
      // heading may never reach the top
      selectItem(id)

      // Smooth-scroll; CSS scroll-margin-top handles the header offset
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Expose the active index and the click handler
  return {
    activeIndex,
    handleNavigationClick,
  }
}
