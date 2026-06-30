'use client'

import { useCssVariablePx } from './use-css-variable-px'

/**
 * A hook that exposes the current sticky site-header height in pixels, tracked across breakpoints.
 *
 * @returns The header height in pixels, or 0 before hydration.
 */
export function useHeaderHeight(): number {
  // Read the height the stylesheet owns under --header-height
  return useCssVariablePx('--header-height')
}
