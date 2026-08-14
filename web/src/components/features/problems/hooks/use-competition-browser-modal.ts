import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { URL_PARAMS } from '../utils/search-url-serialization'

/**
 * Return type of the {@link useCompetitionBrowserModal} hook
 */
type UseCompetitionBrowserModalReturn = {
  /** Whether the competition browser modal is currently open */
  isOpen: boolean
  /** Opens the competition browser modal and updates the URL */
  open: () => void
  /** Closes the competition browser modal and removes the url param indicating the modal is open */
  closeWithUrlUpdate: () => void
  /** Closes the modal UI state without updating the URL (useful when something else will update the URL) */
  closeWithoutUrlUpdate: () => void
}

/**
 * Hook for managing the competition browser modal's open/close state.
 *
 * Uses internal React state for the modal visibility, with URL synchronization:
 * - Reads from URL only once on mount (to support direct links with modal open)
 * - Writes to URL when opening/closing (for shareable links and browser history)
 *
 * Internal state (not URL-derived per render) keeps the modal isolated from debounced filter URL
 * updates, so those can't race with the modal's own open/close writes.
 */
export function useCompetitionBrowserModal(): UseCompetitionBrowserModalReturn {
  // The router needed to change the URL when opening/closing the competition browser modal
  const router = useRouter()

  // Get the current URL search params
  // (from which we might derive the state of the competition browser modal)
  const searchParams = useSearchParams()

  // Internal state for modal visibility
  const [isOpen, setIsOpen] = useState(false)

  // Track whether we've initialized from URL (one-time read on mount)
  const hasInitialized = useRef(false)

  // Initialize modal state from URL on mount (one-time)
  useEffect(() => {
    // Don't run more than once
    if (hasInitialized.current) return

    // Mark as initialized
    hasInitialized.current = true

    // Check if the URL has the browse competitions param
    const shouldOpen = searchParams.get(URL_PARAMS.BROWSE_COMPETITIONS) === 'true'

    // If it does, open the modal
    if (shouldOpen) {
      setIsOpen(true)
    }
  }, [searchParams])

  /** Opens the competition browser modal and updates the URL */
  const open = useCallback(() => {
    // Update internal state first (immediate UI response)
    setIsOpen(true)

    // Then update URL for shareability
    const params = new URLSearchParams(searchParams.toString())
    params.set(URL_PARAMS.BROWSE_COMPETITIONS, 'true')
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  /** Closes the competition browser modal and removes the browse competitions param from URL */
  const closeWithUrlUpdate = useCallback(() => {
    // Update internal state first (immediate UI response)
    setIsOpen(false)

    // Then update URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete(URL_PARAMS.BROWSE_COMPETITIONS)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  /**
   * Closes the modal UI state only, without updating the URL.
   * Used when the caller will update the URL themselves
   */
  const closeWithoutUrlUpdate = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Return the state and actions for the parent component to use
  return { isOpen, open, closeWithUrlUpdate, closeWithoutUrlUpdate }
}
