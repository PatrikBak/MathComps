import { useReducedMotion } from '@mantine/hooks'
import { type CSSProperties, type RefCallback, type RefObject, useEffect, useRef } from 'react'

import { useScrollFade } from '@/hooks/use-scroll-fade'

/** The scroll affordances a horizontally-scrollable tab strip wires up. */
export type TabStripScroll = {
  /** Callback ref for the scroll container. */
  scrollerRef: RefCallback<HTMLDivElement>
  /** Ref for the active tab, kept centered as the selection changes. */
  activeTabRef: RefObject<HTMLButtonElement | null>
  /** A mask style fading whichever edge still hides tabs, or undefined when the row fits. */
  maskStyle: CSSProperties | undefined
}

/**
 * Wires a horizontally-scrollable tab strip's scroll affordances: it keeps the active tab centered as
 * the selection moves and fades whichever edge still hides tabs so the strip reads as scrollable. The
 * centering respects the reduced-motion preference.
 *
 * @param selectedIndex - The active tab's index; re-centers the strip when it changes.
 *
 * @returns The scroller + active-tab refs and the edge-fade mask style.
 */
export function useTabStripScroll(selectedIndex: number): TabStripScroll {
  // Jump rather than animate when the user prefers reduced motion
  const reduceMotion = useReducedMotion()
  // The active tab, kept centered within the strip as pages change
  const activeTabRef = useRef<HTMLButtonElement | null>(null)
  // Edge-overflow tracking plus the ready fade mask, attached straight to the scroller
  const { ref: scrollerRef, maskStyle } = useScrollFade<HTMLDivElement>()

  // Keep the active tab centered within the strip as the page changes
  useEffect(() => {
    // Center it without nudging the page vertically
    activeTabRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [selectedIndex, reduceMotion])

  // Carry focus along with the active tab, for a reader who is standing in the strip
  useEffect(() => {
    // The tab that just became active, which is the only one the strip offers to Tab
    const activeTab = activeTabRef.current

    // A reader paging from somewhere else on the page has not asked to be moved into the strip
    if (!activeTab?.parentElement?.contains(document.activeElement)) return

    // The tab that held focus is no longer a tab stop, so leaving focus on it would strand it
    activeTab.focus()
  }, [selectedIndex])

  // Hand back the refs and the fade mask for the strip to render
  return { scrollerRef, activeTabRef, maskStyle }
}
