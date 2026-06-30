'use client'

import { useCssVariablePx } from './use-css-variable-px'

/**
 * A hook returning the scroll-spy offset in pixels — the top inset anchored sections reserve to clear
 * the sticky header — tracked across breakpoints.
 *
 * @returns The scroll offset in pixels, or 0 before hydration.
 */
export function useScrollOffset(): number {
  // Read the offset the stylesheet owns under --scroll-offset
  return useCssVariablePx('--scroll-offset')
}
