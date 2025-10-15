'use client'

import { useMediaQuery } from '@mantine/hooks'

/**
 * Custom hook that returns the appropriate scroll offset based on screen size.
 * Accounts for different header heights on mobile vs desktop.
 * Used for:
 * - Scroll offset when navigating to anchor links
 * - Scroll-spy offset for detecting active sections
 * - Any JavaScript logic that needs to account for the fixed header
 */
export function useScrollOffset(): number {
  // Use Tailwind's 'lg' breakpoint (1024px) to match header responsive behavior
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Desktop: larger header with more padding
  // Mobile: smaller header with less padding
  return isDesktop ? 96 : 68
}
