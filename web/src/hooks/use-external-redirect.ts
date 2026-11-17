'use client'

import { useWindowEvent } from '@mantine/hooks'
import { useEffect, useState } from 'react'

/**
 * The state of a page sending the browser off to another site.
 */
export type UseExternalRedirectResult = {
  /** Whether the page has started sending the browser away and is waiting for it to leave. */
  isRedirecting: boolean

  /** Marks the redirect as started. */
  startRedirect: () => void

  /** Marks the redirect as abandoned, so the page shows its content again. */
  cancelRedirect: () => void
}

/**
 * Tracks a redirect to another site, from the moment the page starts it until the browser leaves.
 *
 * The flag stays up until the page is actually gone. That comes well after the call starting the redirect
 * settles, since the call returns as soon as it has set the new location. The flag drops on its own when
 * the page comes back without having left:
 *
 * - On a back/forward cache restore, which brings the page back with its old state.
 * - When the page's route goes hidden. The router keeps a route the reader left alive, state included,
 *   and shows it again on return.
 *
 * @returns The redirect flag and the functions that set it.
 */
export function useExternalRedirect(): UseExternalRedirectResult {
  // Whether the browser is on its way to the other site
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Drop the flag when the back/forward cache brings the page back
  useWindowEvent('pageshow', (event) => {
    // Only a cache restore revives old state; a fresh load starts with the flag down
    if (event.persisted) {
      setIsRedirecting(false)
    }
  })

  // Drop the flag when the route goes hidden, since hiding a kept route runs this cleanup
  useEffect(() => () => setIsRedirecting(false), [])

  // A function which marks the redirect as started
  const startRedirect = () => setIsRedirecting(true)

  // A function which marks the redirect as abandoned
  const cancelRedirect = () => setIsRedirecting(false)

  // The flag and its setters
  return { isRedirecting, startRedirect, cancelRedirect }
}
