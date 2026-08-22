'use client'

import { useInterval } from '@mantine/hooks'
import { useState } from 'react'

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
 *
 * @returns The current instant, in epoch milliseconds.
 */
export function useNow(tickMs: number = SECOND_MS): number {
  // The instant as of the last tick
  const [now, setNow] = useState(() => Date.now())

  // Re-read it from mount onwards
  useInterval(() => setNow(Date.now()), tickMs, { autoInvoke: true })

  // The instant everything reading this hook agrees on
  return now
}
