/**
 * Virtuoso viewport increase to render items ahead/behind for smoother scroll.
 * These values control how many items are rendered outside the visible viewport
 * to ensure smooth scrolling performance.
 */
export const VIRTUOSO_INCREASE_VIEWPORT_BY = {
  top: 400,
  bottom: 600,
} as const

/**
 * Animation timing constants for problem card animations.
 */
export const ANIMATION_TIMING = {
  /** Stagger delay between card appearances during initial load (ms) */
  staggerDelay: 20,
  /** Duration for card fade-in animations (ms) */
  cardFadeInDuration: 800,
  /** Duration for card fade-out animations (ms) */
  cardFadeOutDuration: 1000,
  /** Delay before triggering card animation after viewport entry (ms) */
  viewportEntryDelay: 20,
} as const

/**
 * Intersection Observer constants for viewport detection.
 */
export const INTERSECTION_OBSERVER = {
  /** Visibility thresholds for triggering animations */
  thresholds: [0.1, 0.3, 0.5, 0.7] as number[],
  /** Root margin for intersection detection (px) */
  rootMargin: '0px 0px -100px 0px',
  /** Minimum visibility ratio to trigger animation */
  minVisibilityRatio: 0.5,
} as const
