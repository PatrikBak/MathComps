'use client'

import { useHash } from '@mantine/hooks'
import { useEffect } from 'react'

import { useScrollOffset } from '@/hooks/useScrollOffset'

// The maximum number of times we'll try to find the element.
const MAX_ATTEMPTS: number = 12

/**
 * Anchor scroll handler that automatically adapts offset to screen size.
 * Accounts for different header heights on mobile vs desktop
 *
 * This component handles hash-based navigation with responsive scroll offset
 * that matches the header's responsive behavior.
 */
export function AnchorScrollHandler() {
  // Use responsive scroll offset that adapts to header height on different screen sizes
  const offset = useScrollOffset()

  // Use Mantine's hook to get the current URL hash.
  const [hash] = useHash()

  // The main effect that triggers whenever the hash or offset changes.
  useEffect(() => {
    // If there's no hash, do nothing.
    if (!hash) return

    // Get the element's ID from the hash.
    const elementId: string = hash.slice(1)

    // Initialize retry counters.
    let attempts: number = 0
    let frameId: number = 0

    // Define the function that attempts to scroll.
    const tryScroll = (): void => {
      // Find the target element in the document.
      const targetElement: HTMLElement | null = document.getElementById(elementId)

      // If the element exists, scroll to it.
      if (targetElement) {
        // Calculate the correct scroll position, accounting for the offset.
        const top: number = targetElement.getBoundingClientRect().top + window.scrollY - offset

        // Perform the scroll.
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })

        // Stop the retry loop.
        return
      }

      // Increment the attempt counter.
      attempts++

      // If we haven't hit the max attempts, try again on the next frame.
      if (attempts < MAX_ATTEMPTS) {
        frameId = requestAnimationFrame(tryScroll)
      }
    }

    // Start the first scroll attempt.
    frameId = requestAnimationFrame(tryScroll)

    // The cleanup function to cancel the animation frame.
    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [hash, offset])

  // This component does not render any visible UI.
  return null
}
