import { animate, type AnimationPlaybackControls, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'

import { useHeaderHeight } from './use-header-height'

/** How one sticky-aware scroll should behave. */
type StickyScrollOptions = {
  /** Extra space left above the element beyond the header, in px. */
  gap?: number
  /** Only scroll up — skip when the element already sits at or below the landing point. */
  onlyUp?: boolean
}

/** A function that scrolls the window so the target element lands under the sticky header. */
type ScrollToElement = (element: HTMLElement | null, options?: StickyScrollOptions) => void

/** Result returned by {@link useStickyScroll}. */
export type UseStickyScrollResult = {
  /** Scrolls the window so the target element lands just beneath the sticky header. */
  scrollToElement: ScrollToElement
}

/**
 * Lands a target element just beneath the sticky site header. Glides with an ease-out tween, snaps
 * under reduced motion, and cancels the in-flight glide when called again rapidly.
 *
 * @returns A scroll function taking the target element and its options.
 */
export function useStickyScroll(): UseStickyScrollResult {
  // The sticky-header offset the target lands below
  const headerHeight = useHeaderHeight()
  // Snap instead of glide when the OS asks for reduced motion
  const prefersReducedMotion = useReducedMotion()
  // The in-flight tween, kept so a rapid re-call can cancel the previous one
  const animationRef = useRef<AnimationPlaybackControls | null>(null)

  // Scroll the window so the element lands under the header
  const scrollToElement = useCallback<ScrollToElement>(
    (element, options) => {
      // Nothing to scroll to
      if (!element) return
      // Where we are now
      const start = window.scrollY
      // The element's document-space top, less the header and any extra gap
      const target =
        element.getBoundingClientRect().top + start - headerHeight - (options?.gap ?? 0)
      // Up-only callers skip a downward scroll
      if (options?.onlyUp && start <= target) return
      // Reduced motion: snap straight there, forcing instant past the global smooth-scroll
      if (prefersReducedMotion) {
        window.scrollTo({ top: target, behavior: 'instant' })
        return
      }
      // Cancel any tween still in flight before starting the next
      animationRef.current?.stop()
      // Glide with an ease-out tween whose duration scales to the distance, clamped to 0.4-0.7s
      const duration = Math.min(0.7, Math.max(0.4, Math.abs(start - target) / 1600))
      // Each frame jumps instantly so the global smooth-scroll can't spawn a competing native scroll
      animationRef.current = animate(start, target, {
        duration,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (top) => window.scrollTo({ top, behavior: 'instant' }),
      })
    },
    [headerHeight, prefersReducedMotion]
  )

  // Stop an in-flight tween if the consumer unmounts mid-glide
  useEffect(() => () => animationRef.current?.stop(), [])

  // Hand back the scroll control
  return { scrollToElement }
}
