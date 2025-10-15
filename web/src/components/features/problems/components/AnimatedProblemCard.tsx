'use client'
import React, { useEffect, useState } from 'react'

import { ANIMATION_TIMING, INTERSECTION_OBSERVER } from '../constants/problem-list-constants'
import { ProblemCard, type ProblemCardProps } from './ProblemCard'

/**
 * Handles three animation scenarios:
 * 1. Initial page load - Staggered timing from top to bottom
 * 2. Search results - All cards animate as a batch
 * 3. Infinite scroll - New cards fade in when entering viewport
 *
 * Uses pure opacity transitions to avoid layout shifts.
 */
type AnimatedProblemCardProps = ProblemCardProps & {
  index: number
  isNewBatch: boolean
  scrollDirection: 'up' | 'down' | null
  isInitialLoad: boolean
}

export const AnimatedProblemCard = React.memo(function AnimatedProblemCard({
  problem,
  ordinalNumber,
  index,
  isNewBatch,
  scrollDirection,
  isInitialLoad,
  areTechniquesGloballyVisible,
  onTagClick,
  selectedTagSlugs,
  onAuthorClick,
  selectedAuthorSlugs,
  activeTechniqueFilterSlugs,
}: AnimatedProblemCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isInViewport, setIsInViewport] = useState(false)

  const elementRef = React.useRef<HTMLDivElement>(null)
  const problemSlugRef = React.useRef<string>('') // Tracks problem changes for Virtuoso element reuse

  /**
   * Batch animation for initial load and search results.
   * Creates staggered "wave" effect from top to bottom.
   */
  useEffect(() => {
    if (isNewBatch || isInitialLoad) {
      setIsVisible(false)
      setHasAnimated(false)
      setIsInViewport(false)

      // Staggered delay: each card appears a bit after the previous one
      const staggerDelay = index * ANIMATION_TIMING.staggerDelay

      const timer = setTimeout(() => {
        setIsVisible(true)
        setHasAnimated(true)
      }, staggerDelay)

      return () => clearTimeout(timer)
    }
  }, [isNewBatch, index, isInitialLoad])

  /**
   * Viewport entry animation for infinite scroll.
   * Only animates when scrolling down, uses 50% visibility threshold.
   */
  useEffect(() => {
    if (!isNewBatch && !isInitialLoad && elementRef.current) {
      const isDifferentProblem = problemSlugRef.current !== problem.slug
      problemSlugRef.current = problem.slug

      // Always show items to prevent empty space during fast scrolling
      setIsVisible(true)

      // Skip animation when scrolling up (unless it's a different problem due to element reuse)
      if (scrollDirection === 'up' && !isDifferentProblem && hasAnimated) {
        return
      }

      if (!hasAnimated || isDifferentProblem) {
        setHasAnimated(false)
        setIsInViewport(false)

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              // Trigger animation when card is visible enough
              if (
                entry.isIntersecting &&
                entry.intersectionRatio > INTERSECTION_OBSERVER.minVisibilityRatio
              ) {
                if (!isInViewport) {
                  setIsInViewport(true)

                  setTimeout(() => {
                    setHasAnimated(true)
                  }, ANIMATION_TIMING.viewportEntryDelay)

                  observer.disconnect()
                }
              }
            })
          },
          {
            threshold: INTERSECTION_OBSERVER.thresholds,
            rootMargin: INTERSECTION_OBSERVER.rootMargin, // Only trigger when well inside viewport
          }
        )

        observer.observe(elementRef.current)
        return () => observer.disconnect()
      } else {
        setHasAnimated(true)
      }
    }
  }, [problem.slug, isNewBatch, isInitialLoad, hasAnimated, index, scrollDirection, isInViewport])

  return (
    <div
      ref={elementRef}
      className={`py-2 sm:py-3 lg:py-4 first:pt-0 pr-2 ${
        isNewBatch || isInitialLoad
          ? isVisible
            ? `opacity-100 transition-opacity duration-[${ANIMATION_TIMING.cardFadeInDuration}ms] ease-out`
            : 'opacity-80 transition-none'
          : hasAnimated
            ? `opacity-100 transition-opacity duration-[${ANIMATION_TIMING.cardFadeInDuration}ms] ease-out`
            : `opacity-80 transition-opacity duration-[${ANIMATION_TIMING.cardFadeOutDuration}ms] ease-out`
      }`}
      style={{
        willChange: 'opacity',
      }}
    >
      <div>
        <ProblemCard
          problem={problem}
          ordinalNumber={ordinalNumber}
          areTechniquesGloballyVisible={areTechniquesGloballyVisible}
          onTagClick={onTagClick}
          selectedTagSlugs={selectedTagSlugs}
          onAuthorClick={onAuthorClick}
          selectedAuthorSlugs={selectedAuthorSlugs}
          activeTechniqueFilterSlugs={activeTechniqueFilterSlugs}
        />
      </div>
    </div>
  )
})
