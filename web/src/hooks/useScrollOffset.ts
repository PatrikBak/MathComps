'use client'

import { useViewportSize } from '@mantine/hooks'

/**
 * Custom hook that returns the current scroll offset from CSS.
 * Reads the --scroll-offset CSS variable which is set responsively in globals.css.
 * Used for scroll-spy offset detection where JS needs to know the header height.
 */
export function useScrollOffset(): number {
  // Re-render when viewport changes (which may trigger CSS breakpoint changes)
  useViewportSize()

  // Guard against SSR - getComputedStyle and document are browser-only APIs
  if (typeof window === 'undefined') {
    return 0
  }

  // Read the current value from CSS (respects current breakpoint)
  const cssValue = getComputedStyle(document.documentElement).getPropertyValue('--scroll-offset')
  return parseInt(cssValue, 10)
}
