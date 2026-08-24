'use client'

import { useEffect, useState } from 'react'

import { SECOND_MS } from '@/components/shared/utils/time-units'

/**
 * The current instant, re-read every second, or on whatever interval the caller asks for.
 *
 * One clock for a whole surface rather than one per element, so a deadline passing moves every part of the
 * screen on the same tick.
 *
 * The instant this starts from differs between the server's render and the browser's, so a caller must not
 * render anything derived from it until the browser has taken over.
 *
 * @param tickMs - How often to re-read the clock, in milliseconds.
 * @param isEnabled - Whether the clock runs at all; a caller with nothing to time holds it still.
 *
 * @returns The current instant, in epoch milliseconds.
 */
export function useNow(tickMs: number = SECOND_MS, isEnabled: boolean = true): number {
  // The instant as of the last tick
  const [now, setNow] = useState(() => Date.now())

  // Run the clock only while the caller has something to time
  useEffect(() => {
    // Nothing to time, so nothing runs
    if (!isEnabled) {
      return
    }

    // A surface the reader navigated away from and came back to keeps the state it had while its interval
    // was stopped, so its first frame back would otherwise be drawn against whenever it last ticked: a
    // countdown reappearing at the reading it was left at, and then jumping
    setNow(Date.now())

    // The tick
    const intervalId = setInterval(() => setNow(Date.now()), tickMs)

    // Stop the clock once the caller is gone or has nothing left to time
    return () => clearInterval(intervalId)
  }, [isEnabled, tickMs])

  // The instant everything reading this hook agrees on
  return now
}
