'use client'

import type { RefObject } from 'react'
import { useCallback, useRef } from 'react'

/**
 * The callback ref for elements that share one ref and can stand at the same time. It keeps the ref on the
 * element mounted most recently, and hands it back to the one before when that element goes.
 *
 * React clears a shared ref whenever any holder of it unmounts, and never reattaches the element still on
 * screen, so a temporary copy of something (a dialog's own editor over an inline one) leaves the ref empty
 * behind it. Handing it back is what keeps the survivor reachable.
 *
 * @param ref - The ref the elements share, and the one every reader of it goes on reading.
 *
 * @returns The callback ref each of the elements is rendered with.
 */
export function useAttachLastMounted<T>(ref: RefObject<T | null>): (element: T) => () => void {
  // Everything on screen, in the order it arrived, so the one before can take over
  const mounted = useRef<T[]>([])

  // The callback ref the elements attach through
  return useCallback(
    (element: T) => {
      // The element is on screen from here
      mounted.current.push(element)

      // and the ref goes to the newest arrival
      ref.current = element

      // What React runs once the element goes
      return () => {
        // The element is off the list
        mounted.current = mounted.current.filter((candidate) => candidate !== element)

        // and the ref goes back to whatever is still standing
        ref.current = mounted.current.at(-1) ?? null
      }
    },
    [ref]
  )
}
