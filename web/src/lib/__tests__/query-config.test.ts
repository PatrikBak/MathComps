// Dropping reads in flight: a read that left before a write never lands over it, and a first read with nothing
// cached yet still lands.

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { dropReadsInFlight } from '../query-config'

/** Where the answer is cached in every case. */
const KEY = ['thread', 'one']

/**
 * Starts a read of {@link KEY} whose answer arrives only when the test says so.
 *
 * @param queryClient - The cache the read lands in.
 *
 * @returns A function which lets the answer arrive, and the read itself to wait on.
 */
function startRead(queryClient: QueryClient) {
  // The way to let the answer arrive, filled in by the read below
  let answer: (value: string) => void = () => {}

  // The read, made again whatever is cached
  const read = queryClient.prefetchQuery({
    queryKey: KEY,
    queryFn: () => new Promise<string>((resolve) => (answer = resolve)),
    staleTime: 0,
  })

  // The way to let the answer arrive and the read, for the test to drive
  return { answer: (value: string) => answer(value), read }
}

describe('dropReadsInFlight', () => {
  it('keeps a write over a read that left before it', async () => {
    // A cache holding an answer
    const queryClient = new QueryClient()
    queryClient.setQueryData(KEY, 'before')

    // A read of the answer already out
    const { answer, read } = startRead(queryClient)

    // The read dropped, as a write does first
    dropReadsInFlight(queryClient, KEY)

    // The write
    queryClient.setQueryData(KEY, 'written')

    // The read's answer arriving late, from before the write
    answer('read before the write')

    // The read, settled
    await read

    // The write stands
    expect(queryClient.getQueryData(KEY)).toBe('written')
  })

  it('lets a first read land when nothing was cached', async () => {
    // A cache holding nothing
    const queryClient = new QueryClient()

    // The first read, out
    const { answer, read } = startRead(queryClient)

    // Dropping reads while the first read is out
    dropReadsInFlight(queryClient, KEY)

    // The read's answer arriving
    answer('first')

    // The read, settled
    await read

    // The first answer is there to show
    expect(queryClient.getQueryData(KEY)).toBe('first')
  })
})
