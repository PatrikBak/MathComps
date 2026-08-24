'use client'

import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

/**
 * Whether the component is still on screen, readable from a continuation it left behind.
 *
 * A ref rather than state, because what reads it is usually a callback the component handed to something
 * slower than itself: state would hand that callback whatever the render which created it held, which is
 * the answer from before the reader left. It is set on every mount rather than only cleared on unmount, so
 * a remount, which development's double-invoke performs on every component, does not leave it reading false
 * for a component that is back.
 *
 * @returns The ref, true for as long as the component is mounted.
 */
export function useIsMountedRef(): RefObject<boolean> {
  // Whether the component is on screen
  const isMountedRef = useRef(true)

  // The mount and the unmount, which are the two moments the answer changes
  useEffect(() => {
    // On screen from here
    isMountedRef.current = true

    // And gone from here
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // The answer
  return isMountedRef
}
