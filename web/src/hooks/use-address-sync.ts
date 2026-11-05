'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { addressCarries, mergeOwnedParams, replaceQuery } from '@/components/shared/utils/url-utils'

/**
 * Keeps the address bar saying what a screen is showing, so a reload lands back where the reader was and what they
 * are looking at can be sent to somebody else.
 *
 * Every write replaces rather than pushes. Walking a list produces an address per item, and a back button that had
 * to be pressed forty times to leave the page would be worse than no history at all.
 *
 * A screen sharing the address also keeps its parameters there through a navigation that drops them, such as a link
 * to the bare page it is on, which leaves the screen as it was. It puts back what it last said and never takes the
 * address's word for it: the address Next reports trails the screen's own writes, and Next briefly puts each older
 * address it is still catching up on back in the address bar, so adopting it would undo what the reader just did.
 * Only the parameters the screen says count, since one it owns but leaves out can be another writer's to say. And
 * only a say the address has carried is put back: one the address never held, such as a default it leaves unnamed,
 * stays unwritten until the screen changes. A step back or forward through history is left as it lands, since there
 * the address leads and a screen following history takes that step's parameters up itself.
 *
 * @param query - What the screen is showing, as the query string the address should carry, without its leading
 * question mark. The same screen must always make the same string, or an unchanged one is written again.
 * @param ownedParams - The parameters the screen owns, for an address it shares with another writer: a write
 * replaces those alone, leaving the rest as they stand. Left out, the screen owns the whole query.
 */
export function useAddressSync(query: string, ownedParams?: readonly string[]): void {
  // What the address already says, starting at what the page loaded on, so the first say, which is always the
  // address the reader is already looking at, leaves it as it was
  const publishedRef = useRef(query)

  // Whether the address has carried what the screen last said, which the screen first finds out on mount
  const hasCarriedRef = useRef(false)

  // The address as of Next's last navigation, a new one after every navigation, the screen's own writes included
  const navigated = useSearchParams()

  // Say what is on screen, every time it changes
  useEffect(() => {
    // Saying it already means there is nothing to do
    if (query === publishedRef.current) return

    // What the address now stands at
    publishedRef.current = query

    // Onto the address, leaving the page where it stands and any other writer's parameters as they are
    replaceQuery(ownedParams === undefined ? query : mergeOwnedParams(query, ownedParams))

    // What the screen said, now on the address
    hasCarriedRef.current = true
  }, [query, ownedParams])

  // Look at the address on mount and after every navigation, saying again what a navigation dropped
  useEffect(() => {
    // Only a screen sharing the address puts its parameters back
    if (ownedParams === undefined) return

    // The address saying what the screen last said, which it has now carried
    if (addressCarries(publishedRef.current)) {
      // Carried, so a navigation dropping it later puts it back
      hasCarriedRef.current = true

      // Nothing to put back
      return
    }

    // A say the address has never carried, which the screen leaves it without
    if (!hasCarriedRef.current) return

    // A step back or forward through history, left as it lands. Next commits the step while its event is still
    // being handled, which is when React reads this same event to show the step at once
    if (window.event?.type === 'popstate') return

    // Back onto the address, any other writer's parameters as they are
    replaceQuery(mergeOwnedParams(publishedRef.current, ownedParams))
  }, [navigated, ownedParams])
}
