'use client'

import { type RefObject, useLayoutEffect, useRef } from 'react'

import { OPEN_ID_ATTRIBUTE } from './use-focus-return'

/**
 * Return type for {@link useFocusHandOff}, spread onto the item's element.
 */
type UseFocusHandOffResult = {
  /** The item's element. */
  ref: RefObject<HTMLDivElement | null>
  /** Notes the focus arriving in the item, a menu it opens over the page included. */
  onFocus: () => void
  /** Notes the focus leaving the item. */
  onBlur: () => void
}

/**
 * Hands the focus on when an item of a list leaves the page holding it: to the link of whichever item then stands
 * in its place, found by {@link OPEN_ID_ATTRIBUTE}, or to a fallback when none does. The item's focus is kept up
 * with through React's focus events, which reach it from a menu it opens over the page too. An item only hidden,
 * like a list behind something open over it, hands nothing on, and neither does one whose focus something else
 * has taken since.
 *
 * @param fallbackRef - What takes the focus when no item stands in the leaving one's place.
 *
 * @returns The item's element and its focus handlers.
 */
export function useFocusHandOff(fallbackRef: RefObject<HTMLElement | null>): UseFocusHandOffResult {
  // The item's element
  const ref = useRef<HTMLDivElement>(null)

  // Whether the focus is in the item, the menus it opens included
  const holdsFocusRef = useRef(false)

  // The focus handed on as the item goes
  useLayoutEffect(() => {
    // The item's element, while it stands
    const item = ref.current

    // What takes the focus when no item stands in its place
    const fallback = fallbackRef.current

    // The hand-off, run as the item goes
    return () => {
      // An item going without the focus leaves it where it is
      if (item === null || !holdsFocusRef.current) return

      // The item before it and the list holding both, as the list stood
      const previous = item.previousElementSibling
      const list = item.parentElement

      // Once the change is over, an item that left the page hands the focus on, unless something has taken it since
      queueMicrotask(() => {
        // Only hidden, or the focus already taken
        if (item.isConnected || document.activeElement !== document.body) return

        // The item standing in its place now: the one after the item before it, or the list's first
        const next = previous === null ? list?.firstElementChild : previous.nextElementSibling

        // That item's link, while the item stands
        const nextLink = next?.isConnected
          ? next.querySelector<HTMLElement>(OPEN_ID_ATTRIBUTE.anySelector)
          : null

        // Where the focus goes: that link, or the fallback when no item stands there
        const target = nextLink ?? fallback

        // Focused, the page staying where it was
        target?.focus({ preventScroll: true })
      })
    }
  }, [fallbackRef])

  // A function which notes the focus arriving in the item
  const onFocus = () => {
    // The item holds it
    holdsFocusRef.current = true
  }

  // A function which notes the focus leaving the item
  const onBlur = () => {
    // The item no longer holds it
    holdsFocusRef.current = false
  }

  // The item's element and its focus handlers
  return { ref, onFocus, onBlur }
}
