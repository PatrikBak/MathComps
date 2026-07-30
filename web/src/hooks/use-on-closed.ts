'use client'

import { useEffect, useRef } from 'react'

/**
 * Reports the moment something that stood open is closed, and never for something that merely starts closed.
 * The callback runs a frame late on purpose: the closing render is committed before the browser has drawn a
 * page without it, and what it held (the cursor it took, the scroll it froze) comes back over that frame. A
 * caller that measures or scrolls the page needs it to have landed first.
 *
 * @param isOpen - Whether the thing stands open.
 * @param onClosed - Called once it has closed, or undefined when nothing is waiting on that.
 */
export function useOnClosed(isOpen: boolean, onClosed: (() => void) | undefined): void {
  // The callback as it stands when the report is due, rather than as it stood when the close happened
  const callback = useRef(onClosed)

  // Whether it stood open when this last looked, which is what a close is measured against. It has to be a
  // ref: the open flag is then the only thing that reruns the work below, and a report already scheduled
  // survives whatever else settles in the same breath as the close.
  const wasOpen = useRef(isOpen)

  // Keep the callback current
  useEffect(() => {
    callback.current = onClosed
  })

  // Report the close once the page is clear of it
  useEffect(() => {
    // Whether this was a close
    const hasClosed = wasOpen.current && !isOpen

    // What the next change is measured against
    wasOpen.current = isOpen

    // An opening has nothing to report
    if (!hasClosed) {
      return
    }

    // Hand over on the frame that draws the page without it
    const frame = requestAnimationFrame(() => callback.current?.())

    // Say nothing if it reopens, or this goes away, before that frame
    return () => cancelAnimationFrame(frame)
  }, [isOpen])
}
