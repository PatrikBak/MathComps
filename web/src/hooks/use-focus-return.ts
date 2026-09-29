import { useCallback, useRef } from 'react'

import { dataAttribute } from '@/components/shared/utils/dom-utils'

/** The attribute naming which item of a list an element stands for, which is where focus comes back to. */
export const OPEN_ID_ATTRIBUTE = dataAttribute('data-open-id')

/**
 * Sends focus back to whatever on the page stands for the item last open, once that item has closed. An element
 * stands for an item by being stamped with {@link OPEN_ID_ATTRIBUTE}.
 *
 * A dialog's own restore can't do this for a list walked from inside the dialog. It points at whatever was
 * clicked, which stops being the item on screen as soon as the reader steps along, so the element is found again
 * by the id it is stamped with rather than by having been the one clicked.
 *
 * Nothing moves the page on the way back: `focus()` brings its target into view by default, and after a long walk
 * the item the reader ended on can be a long way from where they were reading.
 *
 * @param openId - The item open; null while none is.
 * @returns A function which puts focus back, to be run once whatever showed the item has finished leaving.
 */
export function useFocusReturn(openId: string | null): () => void {
  // The item the reader ended on, held past the point nothing is open so its element can still be found once
  // whatever showed it has finished leaving
  const lastOpenIdRef = useRef<string | null>(null)

  // Kept up with while something is open, and left standing once nothing is
  if (openId !== null) lastOpenIdRef.current = openId

  // A function which puts focus on whatever stands for the item last open
  return useCallback(() => {
    // The item last open
    const id = lastOpenIdRef.current

    // Nowhere to go back to if nothing was ever open
    if (id === null) return

    // Whichever element stands for the item last open, if the page still shows one
    document
      .querySelector<HTMLElement>(OPEN_ID_ATTRIBUTE.selectorFor(id))
      ?.focus({ preventScroll: true })
  }, [])
}
