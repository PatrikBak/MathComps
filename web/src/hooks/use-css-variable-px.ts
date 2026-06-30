'use client'

import { useSyncExternalStore } from 'react'

/**
 * Reads a CSS custom property as an integer number of pixels, kept current across viewport resizes.
 * Use it where JS needs a length the stylesheet owns and varies per breakpoint.
 *
 * @param property - The CSS custom property to read.
 *
 * @returns The current pixel value, or 0 before hydration / when the var is unset or unparseable.
 */
export function useCssVariablePx(property: string): number {
  return useSyncExternalStore(
    // Subscribe to resize events (when CSS variable might change)
    (callback) => {
      window.addEventListener('resize', callback)
      return () => window.removeEventListener('resize', callback)
    },
    // Read the variable on the client
    () => {
      // Get the value of the CSS variable
      const cssValue = getComputedStyle(document.documentElement).getPropertyValue(property)

      // Parse it
      const parsedValue = parseInt(cssValue, 10)

      // Return the parsed value or a safe default
      return isNaN(parsedValue) ? 0 : parsedValue
    },
    // SSR fallback
    () => 0
  )
}
