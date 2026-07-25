import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/** How close to the bottom (px) still counts as "pinned", so new content keeps auto-scrolling. */
const PIN_THRESHOLD_PX = 80

/**
 * A scroll region that follows its own growing content.
 */
export type UseFollowTailResult = {
  /** Ref for the scrollable region. */
  scrollRef: (element: HTMLDivElement | null) => void
  /** Ref for the growing content inside the region. */
  contentRef: (element: HTMLDivElement | null) => void
  /** Whether the reader has scrolled up, away from the bottom. */
  isScrolledUp: boolean
  /** Snaps the region to its newest content. */
  scrollToBottom: () => void
}

/**
 * Whether a region's scroll position sits within the pin threshold of its bottom.
 *
 * @param region - The scrollable region.
 *
 * @returns Whether the region counts as pinned to the bottom.
 */
function isAtBottom(region: HTMLDivElement): boolean {
  // Within the threshold of the bottom counts as pinned
  return region.scrollHeight - region.scrollTop - region.clientHeight <= PIN_THRESHOLD_PX
}

/**
 * Keeps a scroll region pinned to its newest content while the reader sits at the bottom, and yields
 * control once they scroll up to re-read. Attach the region ref to the scrollable element and the
 * content ref to the growing content inside it; content growth is followed on its own, so no
 * per-item dependency is needed.
 *
 * Pinned-ness is recorded as the reader scrolls, BEFORE any growth, so a new block taller than the
 * threshold cannot read as "scrolled up" and break the follow. Content dropping away re-pins on its
 * own, since the reader can end up back at the bottom without ever scrolling there.
 *
 * @returns The region and content refs, whether the reader has scrolled up, and a jump-to-bottom control.
 */
export function useFollowTail(): UseFollowTailResult {
  // The mounted region and content elements, held as state so every subscription re-binds when the
  // consumer remounts them
  const [region, setRegion] = useState<HTMLDivElement | null>(null)
  const [content, setContent] = useState<HTMLDivElement | null>(null)

  // Whether the reader sat at the bottom after their last scroll; starts pinned so the first content
  // lands scrolled into view
  const pinnedRef = useRef(true)

  // The store's change notifier
  const notifyRef = useRef<() => void>(() => {})

  // Records pinned-ness and announces it
  const setPinned = useCallback((pinned: boolean) => {
    pinnedRef.current = pinned
    notifyRef.current()
  }, [])

  // Binds the region, re-pinning first: a freshly mounted region starts at its tail
  const scrollRef = useCallback((element: HTMLDivElement | null) => {
    // A new region begins pinned, before any subscription reads the flag
    if (element) {
      pinnedRef.current = true
    }

    // Track the element so the subscriptions re-bind to it
    setRegion(element)
  }, [])

  // Snaps the region to the newest content
  const scrollToBottom = useCallback(() => {
    // The region may not be mounted yet
    if (!region) {
      return
    }

    // Jump to the bottom where the newest content sits
    region.scrollTop = region.scrollHeight

    // A programmatic jump re-pins even before its scroll event lands
    setPinned(true)
  }, [region, setPinned])

  // Track the reader's position on every scroll. Hand-rolled listener rather than a @mantine/hooks
  // one: useSyncExternalStore needs the add/remove pair returned as a single subscribe function
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Route every recorded pin to the current subscriber
      notifyRef.current = onStoreChange

      // Nothing to watch until the region mounts
      if (!region) {
        return () => {}
      }

      // Record pinned-ness at scroll time, so growth is judged against the pre-growth position
      const onScroll = () => setPinned(isAtBottom(region))

      // Listen for scrolls, passively since we never block them
      region.addEventListener('scroll', onScroll, { passive: true })

      // Drop the listener on teardown
      return () => region.removeEventListener('scroll', onScroll)
    },
    [region, setPinned]
  )

  // Whether the reader has left the bottom, per their last recorded scroll position
  const getSnapshot = useCallback(() => !pinnedRef.current, [])

  // Whether the reader has scrolled up; pinned on the server and before the first scroll
  const isScrolledUp = useSyncExternalStore(subscribe, getSnapshot, () => false)

  // Follow content growth while the reader is pinned to the bottom
  useEffect(() => {
    // Nothing to observe until both the region and its content mount
    if (!region || !content) {
      return
    }

    // Follow the bottom whenever the content resizes, unless the reader had scrolled up before it
    // grew; the observer also fires once on observe, which lands the initial content in view
    const observer = new ResizeObserver(() => {
      // Reading back up the region is not interrupted by new content. Content dropping away is the
      // exception: it can put the bottom back within reach without moving the scroll position, so no
      // scroll event records it. Re-pinning only, so growth still can't pull the reader down.
      if (!pinnedRef.current) {
        // The bottom came back to the reader
        if (isAtBottom(region)) {
          setPinned(true)
        }

        // A reader still up the region stays there
        return
      }

      // Keep the newest content in view
      region.scrollTop = region.scrollHeight
    })

    // Watch the content box for size changes
    observer.observe(content)

    // Stop observing on unmount
    return () => observer.disconnect()
  }, [region, content, setPinned])

  // The region and content refs plus the reader-aware scroll state
  return { scrollRef, contentRef: setContent, isScrolledUp, scrollToBottom }
}
