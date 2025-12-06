'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'

import { useProblemStore } from '@/stores/problem-store'

/**
 * Component that syncs authentication state with the problem store.
 * Specifically, it resets the store when the user logs out.
 */
export function AuthStoreSync() {
  // Get Clerk auth state
  const { userId, isLoaded } = useAuth()

  // Get problem store reset function
  const reset = useProblemStore((state) => state.reset)

  // Keep track of the previous userId to detect changes
  // Initialize as undefined to distinguish from null (logged out)
  const prevUserIdRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Wait for auth to load before making any decisions
    if (!isLoaded) return

    // Check if we transitioned from logged in (string) to logged out (null)
    const wasLoggedIn = typeof prevUserIdRef.current === 'string'
    const isLoggedOut = !userId

    // Only reset from going from logged in to logged out
    if (wasLoggedIn && isLoggedOut) {
      reset()
    }

    // Update the ref for the next effect run
    prevUserIdRef.current = userId
  }, [userId, isLoaded, reset])

  // Return null as we don't render anything
  return null
}
