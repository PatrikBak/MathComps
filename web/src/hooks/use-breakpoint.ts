import { useMediaQuery } from '@mantine/hooks'

/**
 * Tailwind's default breakpoint minimums in pixels. Mirrors the framework's `screens` scale so a JS
 * viewport check flips at the same width as the matching `md:` / `lg:` utility.
 */
const BREAKPOINT_PX = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

/**
 * A Tailwind breakpoint name.
 */
type Breakpoint = keyof typeof BREAKPOINT_PX

/**
 * Whether the viewport is at least the given breakpoint wide, matching the `<breakpoint>:` utility
 * prefix. False on the server and the first client render, then correct after mount.
 */
export function useMinWidth(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINT_PX[breakpoint]}px)`)
}

/**
 * Whether the viewport is below the given breakpoint, matching Tailwind's `max-<breakpoint>:` range.
 * False on the server and the first client render, then correct after mount.
 */
function useMaxWidth(breakpoint: Breakpoint): boolean {
  // Match everything up to one pixel below the breakpoint's minimum
  return useMediaQuery(`(max-width: ${BREAKPOINT_PX[breakpoint] - 1}px)`)
}

/**
 * Whether the viewport is phone-width — below Tailwind's `md`.
 */
export function useIsMobile(): boolean {
  return useMaxWidth('md')
}
