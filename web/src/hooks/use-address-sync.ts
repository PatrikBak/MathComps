'use client'

import { useEffect, useRef } from 'react'

import { replaceQuery } from '@/components/shared/utils/url-utils'

/**
 * Keeps the address bar saying what a screen is showing, so a reload lands back where the reader was and what they
 * are looking at can be sent to somebody else.
 *
 * Every write replaces rather than pushes. Walking a list produces an address per item, and a back button that had
 * to be pressed forty times to leave the page would be worse than no history at all.
 *
 * @param query - What the screen is showing, as the query string the address should carry, without its leading
 * question mark. The same screen must always make the same string, or an unchanged one is written again.
 */
export function useAddressSync(query: string): void {
  // What the address already says, starting at what the page loaded on, so the first say, which is always the
  // address the reader is already looking at, leaves it as it was
  const publishedRef = useRef(query)

  // Say what is on screen, every time it changes
  useEffect(() => {
    // Saying it already means there is nothing to do
    if (query === publishedRef.current) return

    // What the address now stands at
    publishedRef.current = query

    // Onto the address, leaving the page where it stands
    replaceQuery(query)
  }, [query])
}
