import { useCustomScrollSpy } from '@/hooks/use-custom-scroll-spy'
import { useScrollOffset } from '@/hooks/useScrollOffset'

import type { TableOfContentsItem } from './table-of-contents-types'

/**
 * Options for the table of contents navigation hook.
 */
interface UseTableOfContentsNavigationOptions {
  /** Array of navigation items to track */
  items: TableOfContentsItem[]
}

/**
 * Custom hook that provides shared table of contents navigation logic.
 * Handles scroll-spy tracking and navigation clicks.
 *
 * Used by both desktop ({@link TableOfContents}) and mobile ({@link MobileTableOfContents})
 * components to avoid code duplication.
 */
export function useTableOfContentsNavigation({ items }: UseTableOfContentsNavigationOptions) {
  // Initialize our custom scroll-spy
  // Use responsive scroll offset that adapts to header height
  const activeIndex = useCustomScrollSpy({
    itemIds: items.map((item) => item.id),
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

      // scrollIntoView respects CSS scroll-margin-top for header offset
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // The component's users need the current index + the click handler
  return {
    activeIndex,
    handleNavigationClick,
  }
}
