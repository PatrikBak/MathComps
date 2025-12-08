import React from 'react'

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
 * Custom scroll spy hook that correctly tracks section visibility.
 * Unlike Mantine's useScrollSpy (which picks the heading "closest" to an offset line),
 * this implementation picks the LAST heading that has scrolled past the offset threshold.
 * This prevents premature activation of the next section when there are large gaps between headings.
 *
 * @param {CustomScrollSpyOptions} options - The options for the hook
 *
 * @returns {number | undefined} The currently active index (0-based), or undefined if not yet calculated
 */
export function useCustomScrollSpy({
  itemIds,
  offset,
}: CustomScrollSpyOptions): number | undefined {
  // This is what we'll return in the end
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined)

  // Ref for requestAnimationFrame throttling (so we don't trigger on every scroll event)
  const animationFrameIdRef = React.useRef<number | null>(null)

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

      // Check if the element is past the offset (+ 1px tolerance for sub-pixel rounding)
      if (element.getBoundingClientRect().top <= offset + 1) {
        lastPassedIndex = itemIndex
      }
    }

    // Return the last passed index
    return lastPassedIndex
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

  // Return the active index and the force update function
  return activeIndex
}
