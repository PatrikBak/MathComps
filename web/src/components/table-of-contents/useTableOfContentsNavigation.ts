import { useScrollSpy } from '@mantine/hooks'
import React from 'react'

import { escapeCss } from '@/components/shared/utils/css-utils'
import { useScrollOffset } from '@/hooks/useScrollOffset'

import type { TableOfContentsItem } from './table-of-contents-types'

/**
 * Options for the table of contents navigation hook.
 */
interface UseTableOfContentsNavigationOptions {
  /** Array of navigation items to track */
  items: TableOfContentsItem[]
  /** Whether to listen for URL hash changes and scroll to sections when hash changes.
   * Desktop TOC needs this for deep-linking, mobile TOC doesn't need it since it handles navigation differently. */
  enableHashChangeListener?: boolean
}

/**
 * Custom hook that provides shared table of contents navigation logic.
 * Handles scroll-spy tracking, navigation clicks, and hash-based deep linking.
 *
 * Used by both desktop (TableOfContents) and mobile (MobileTableOfContents) components
 * to avoid code duplication.
 *
 * @param options - Configuration options (see {@link UseTableOfContentsNavigationOptions})
 * @returns Active item index and navigation handler
 */
export function useTableOfContentsNavigation({
  items,
  enableHashChangeListener,
}: UseTableOfContentsNavigationOptions) {
  // Get responsive scroll offset that adapts to header height
  const scrollOffset = useScrollOffset()

  // Build CSS selector for all heading elements to track scroll position
  const headingSelector = items.map((item) => `#${escapeCss(item.id)}`).join(', ')
  const scrollSpy = useScrollSpy({ selector: headingSelector, offset: scrollOffset })

  // Handle URL hash navigation on page load and hash changes (typically desktop only)
  React.useEffect(() => {
    if (!enableHashChangeListener) {
      return
    }

    /**
     * Scrolls to the section specified in the URL hash.
     * Supports deep-linking to specific sections.
     */
    const handleHashChange = () => {
      if (window.location.hash) {
        const id = window.location.hash.substring(1)
        const element = document.getElementById(id)
        if (element) {
          // Scroll to element with header offset for proper visibility
          window.scrollTo({
            top: element.offsetTop - scrollOffset,
            behavior: 'smooth',
          })
        }
      }
    }

    // Handle initial hash on page load
    handleHashChange()

    // Listen for hash changes (browser back/forward, manual URL edits)
    window.addEventListener('hashchange', handleHashChange, { passive: true })
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [scrollOffset, enableHashChangeListener])

  /**
   * Navigates to a section by ID with smooth scrolling and URL history update.
   *
   * @param id - The section ID to navigate to
   */
  const handleNavigationClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      // Update URL hash for deep-linking support
      window.history.pushState(null, '', `#${id}`)

      // Smooth scroll to section with header offset
      window.scrollTo({
        top: element.offsetTop - scrollOffset,
        behavior: 'smooth',
      })
    }
  }

  // The component's users need the current index + the handler
  return {
    activeIndex: scrollSpy.active,
    handleNavigationClick,
  }
}
