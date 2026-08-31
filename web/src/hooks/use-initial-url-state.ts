'use client'

import type { ReadonlyURLSearchParams } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useRef } from 'react'

/**
 * Reads what the address bar was asking for the first time anybody looked, and keeps saying that.
 *
 * A screen seeded from the address reads it once and then owns the state: reading it again on a later render
 * would fight whatever the reader has done since, and would fight the screen's own writes back into it.
 *
 * The read happens during render rather than in an effect, so the first paint is already the state the
 * address asked for instead of the default flipping to it a render later.
 *
 * @param read - What to take off the address.
 *
 * @returns What was on the address on the first render to reach here, whatever has happened since.
 */
export function useInitialUrlState<T>(read: (params: ReadonlyURLSearchParams) => T): T {
  // Whatever the address is asking for right now
  const searchParams = useSearchParams()

  // The first reading, boxed so that a null or undefined reading still counts as having been read
  const initialRef = useRef<{ value: T } | null>(null)

  // Read once, on the first render to reach here
  initialRef.current ??= { value: read(searchParams) }

  // That first reading
  return initialRef.current.value
}
