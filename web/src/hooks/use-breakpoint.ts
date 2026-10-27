import { useMediaQuery } from '@mantine/hooks'

/**
 * Tailwind's default breakpoint minimums in rem, mirroring the framework's `--breakpoint-*` scale
 * so a JS viewport check flips at the same width as the matching `md:` / `lg:` utility. The unit
 * matters: a media query's rem follows the browser's default font size, which the reader can set.
 */
const BREAKPOINT_REM = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
} as const

/**
 * A Tailwind breakpoint name.
 */
type Breakpoint = keyof typeof BREAKPOINT_REM

/**
 * Whether the viewport is at least the given breakpoint wide, matching the `<breakpoint>:` utility
 * prefix. False on the server and the first client render, then correct after mount.
 */
export function useMinWidth(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(width >= ${BREAKPOINT_REM[breakpoint]}rem)`)
}

/**
 * Whether the viewport is below the given breakpoint, matching Tailwind's `max-<breakpoint>:` range.
 * False on the server and the first client render, then correct after mount.
 */
function useMaxWidth(breakpoint: Breakpoint): boolean {
  // Match everything narrower than the breakpoint's minimum
  return useMediaQuery(`(width < ${BREAKPOINT_REM[breakpoint]}rem)`)
}

/**
 * Whether the viewport is phone-width — below Tailwind's `md`.
 */
export function useIsMobile(): boolean {
  return useMaxWidth('md')
}
