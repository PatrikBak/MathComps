import { useWindowEvent } from '@mantine/hooks'
import React from 'react'

/** The keys that scroll the page */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

/**
 * Options for the {@link useCustomScrollSpy} hook
 */
type CustomScrollSpyOptions = {
  /** The IDs of the elements to track */
  itemIds: string[]
  /** The offset to use for scroll-spy detection, use-case is a fixed header */
  offset: number
}

/**
 * Result of the {@link useCustomScrollSpy} hook.
 */
type UseCustomScrollSpyResult = {
  /** The currently active index (0-based), or undefined if not yet calculated */
  activeIndex: number | undefined
  /**
   * Marks an item as the reader's pick, shown at the bottom of the page until they scroll by wheel,
   * touch or keyboard
   */
  selectItem: (id: string) => void
}

/**
 * Custom scroll spy hook that correctly tracks section visibility.
 * Unlike Mantine's useScrollSpy (which picks the heading "closest" to an offset line),
 * this implementation picks the LAST heading that has scrolled past the offset threshold.
 * This prevents premature activation of the next section when there are large gaps between headings.
 * At the bottom of the page, where the last headings may never reach the threshold, it picks the
 * item the reader selected, or else the last.
 *
 * @param {CustomScrollSpyOptions} options - The options for the hook
 *
 * @returns The active index, and the way to select an item
 */
export function useCustomScrollSpy({
  itemIds,
  offset,
}: CustomScrollSpyOptions): UseCustomScrollSpyResult {
  // The active index
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined)

  // Ref for requestAnimationFrame throttling (so we don't trigger on every scroll event)
  const animationFrameIdRef = React.useRef<number | null>(null)

  // The id of the item the reader selected, until they scroll by wheel, touch or keyboard
  const selectedIdRef = React.useRef<string | null>(null)

  /** Calculate the active index based on scroll position */
  const calculateActiveIndex = React.useCallback((): number => {
    // The default will be the first item
    let lastPassedIndex = 0

    // Iterate over all items
    for (let itemIndex = 0; itemIndex < itemIds.length; itemIndex++) {
      // Get the element from the DOM
      const element = document.getElementById(itemIds[itemIndex])

      // Guard against incorrect IDs
      if (!element) continue

      // Check if the element is past the offset (+ 5px tolerance for sub-pixel rounding)
      if (element.getBoundingClientRect().top <= offset + 5) {
        lastPassedIndex = itemIndex
      }
    }

    // Whether the page sits at its bottom, where the last headings may never reach the offset line
    const isScrolledToBottom =
      window.scrollY > 0 &&
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1

    // Short of the bottom, the last heading past the offset line is the one being read
    if (!isScrolledToBottom) return lastPassedIndex

    // Where the reader's selected item sits in the list, -1 for none
    const selectedIndex =
      selectedIdRef.current === null ? -1 : itemIds.indexOf(selectedIdRef.current)

    // At the bottom, the selected item if it follows every heading past the offset line, else the
    // last one
    return selectedIndex > lastPassedIndex ? selectedIndex : itemIds.length - 1
  }, [itemIds, offset])

  // The main effect which sets up the scroll listener
  React.useEffect(() => {
    /** Scroll handler throttled via requestAnimationFrame */
    const handleScroll = () => {
      // Skip if we already have a pending frame
      if (animationFrameIdRef.current !== null) return

      // Request a frame to update the active index
      animationFrameIdRef.current = requestAnimationFrame(() => {
        // Clear the pending frame
        animationFrameIdRef.current = null

        // Update the active index
        setActiveIndex(calculateActiveIndex())
      })
    }

    // Run immediately for initial render
    setActiveIndex(calculateActiveIndex())

    // Run on every scroll event
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Cleanup
    return () => {
      // Remove the scroll listener
      window.removeEventListener('scroll', handleScroll)

      // Cancel any pending animation frames
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current)
      }
    }
  }, [calculateActiveIndex])

  // A function which marks an item as the reader's pick. It shows at once, since at the bottom of
  // the page the scroll to it may move nothing
  const selectItem = React.useCallback(
    (id: string) => {
      // Remember the pick
      selectedIdRef.current = id

      // Recalculate the active index with the selection in hand
      setActiveIndex(calculateActiveIndex())
    },
    [calculateActiveIndex]
  )

  // A function which drops the reader's pick
  const forgetSelection = () => {
    // Nothing to drop
    if (selectedIdRef.current === null) return

    // Forget the selected item
    selectedIdRef.current = null

    // Show what the scroll position alone says
    setActiveIndex(calculateActiveIndex())
  }

  // Forget the selection when the reader moves the page by wheel or touch
  useWindowEvent('wheel', forgetSelection, { passive: true })
  useWindowEvent('touchmove', forgetSelection, { passive: true })

  // Forget the selection when the reader moves the page by keyboard
  useWindowEvent('keydown', (event) => {
    // Only a key that scrolls the page
    if (SCROLL_KEYS.has(event.key)) forgetSelection()
  })

  // Return the active index and the way to select an item
  return { activeIndex, selectItem }
}
