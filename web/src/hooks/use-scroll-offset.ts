'use client'

import { useSyncExternalStore } from 'react'

/**
 * Custom hook that returns the current scroll offset from CSS.
 * Reads the --scroll-offset CSS variable which is set responsively in globals.css.
 * Used for scroll-spy offset detection where JS needs to know the header height.
 */
export function useScrollOffset() {
  return useSyncExternalStore(
    // Subscribe to resize events (when CSS variable might change)
    (callback) => {
      window.addEventListener('resize', callback)
      return () => window.removeEventListener('resize', callback)
    },
    // The client-side function to get the scroll offset
    () => {
      // Get the value of the CSS variable
      const cssValue = getComputedStyle(document.documentElement).getPropertyValue(
        '--scroll-offset'
      )

      // Parse it
      const parsedValue = parseInt(cssValue, 10)

      // Return the parsed value or a safe default
      return isNaN(parsedValue) ? 0 : parsedValue
    },
    // SSR fallback
    () => 0
  )
}
