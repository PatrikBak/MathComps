'use client'

import { useAuth } from '@clerk/nextjs'
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Names the signed-in user on each error the browser reports once Clerk has loaded, by the Clerk id the API's
 * events carry too, so one student's errors match between the website and the API. The id is all that goes.
 */
export function ErrorTrackingUserSync() {
  // The signed-in user's Clerk id, null for a visitor, and whether Clerk has loaded
  const { userId, isLoaded } = useAuth()

  // Keep error tracking's user in step with whoever is signed in
  useEffect(() => {
    // Until Clerk has loaded, nobody is known yet
    if (!isLoaded) {
      return
    }

    // Name the user, or clear the name once they sign out
    Sentry.setUser(userId ? { id: userId } : null)
  }, [userId, isLoaded])

  // Nothing to render
  return null
}
