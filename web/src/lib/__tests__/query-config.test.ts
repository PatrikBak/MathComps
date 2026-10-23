// Dropping reads in flight: a read that left before a write never lands over it, and a first read with nothing
// cached yet still lands. Waiting for the page: it is heard once as it comes on screen. Waiting for an answer: a failed
// read and an answer written straight in are waited past, a read is set off unless the last failed for good or a write
// holds it back, and a wait hears nothing from a read landing elsewhere, nor anything once stopped.

import { focusManager, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BackendApiError } from '../api/api-error'
import { dropReadsInFlight, onceAnswerLands, oncePageShows } from '../query-config'

/** Where the answer is cached in every case. */
const KEY = ['thread', 'one']

/** Where another answer is cached, beside the one a case waits for. */
const OTHER_KEY = ['thread', 'two']

/** The writes that hold a read back while they are out. */
const WRITES = { mutationKey: ['write'] }

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

describe('oncePageShows', () => {
  // The page as the browser tells it again, once each case is done
  afterEach(() => focusManager.setFocused(undefined))

  it('hears once as the page comes on screen, and not again as it shows again', () => {
    // A page out of sight
    focusManager.setFocused(false)

    // The callback the wait calls
    const onShown = vi.fn()

    // The wait for the page to show
    oncePageShows(onShown)

    // Nothing heard while the page is out of sight
    expect(onShown).not.toHaveBeenCalled()

    // The page on screen
    focusManager.setFocused(true)

    // Heard
    expect(onShown).toHaveBeenCalledOnce()

    // The page out of sight again
    focusManager.setFocused(false)

    // And on screen again
    focusManager.setFocused(true)

    // Heard no more
    expect(onShown).toHaveBeenCalledOnce()
  })
})

describe('onceAnswerLands', () => {
  it('waits past a failed read and an answer written straight in, and hears once from a read that lands', async () => {
    // A cache whose read of the answer is out and about to fail
    const queryClient = new QueryClient()
    const failing = queryClient.prefetchQuery({
      queryKey: KEY,
      queryFn: () => Promise.reject(new Error('unreachable')),
      retry: false,
    })

    // The callback the wait calls
    const onLanded = vi.fn()

    // The wait for an answer
    onceAnswerLands(queryClient, KEY, WRITES, onLanded)

    // The read, failed
    await failing

    // An answer written straight in
    queryClient.setQueryData(KEY, 'written')

    // Neither heard
    expect(onLanded).not.toHaveBeenCalled()

    // A later read, landing
    await queryClient.prefetchQuery({ queryKey: KEY, queryFn: () => 'landed', staleTime: 0 })

    // Another read after it
    await queryClient.prefetchQuery({ queryKey: KEY, queryFn: () => 'again', staleTime: 0 })

    // Heard once, from the first read that landed
    expect(onLanded).toHaveBeenCalledOnce()
  })

  it('sets a read off where none is out, and hears it land', async () => {
    // A cache holding an answer read earlier, with no read out
    const queryClient = new QueryClient()
    await queryClient.prefetchQuery({ queryKey: KEY, queryFn: () => 'read' })

    // The callback the wait calls
    const onLanded = vi.fn()

    // The wait for an answer
    onceAnswerLands(queryClient, KEY, WRITES, onLanded)

    // Heard from the read it set off
    await vi.waitFor(() => expect(onLanded).toHaveBeenCalledOnce())
  })

  it('sets no read off after one the backend refused for good, nor while a write it is held by is out', async () => {
    // A cache whose read of the answer the backend refused, as no repeat could change
    const queryClient = new QueryClient()
    const refused = vi.fn(() => Promise.reject(new BackendApiError({ statusCode: 404 })))
    await queryClient.prefetchQuery({ queryKey: KEY, queryFn: refused, retry: false })

    // Another answer, read fine
    const read = vi.fn(() => 'read')
    await queryClient.prefetchQuery({ queryKey: OTHER_KEY, queryFn: read })

    // A write holding back the read of the other answer, out until the test is done
    void queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: WRITES.mutationKey,
        mutationFn: () => new Promise(() => {}),
      })
      .execute(undefined)

    // The wait for the refused answer, held by no write that is out
    onceAnswerLands(queryClient, KEY, { mutationKey: ['another write'] }, vi.fn())

    // The wait for the other answer, held by the write that is out
    onceAnswerLands(queryClient, OTHER_KEY, WRITES, vi.fn())

    // Long enough for a read to have set off
    await new Promise((resolve) => setTimeout(resolve, 0))

    // None did
    expect([refused, read].map((queryFn) => queryFn.mock.calls.length)).toEqual([1, 1])
  })

  it('hears nothing from a read landing in another query', async () => {
    // A cache whose read of the answer is out
    const queryClient = new QueryClient()
    startRead(queryClient)

    // The callback the wait calls
    const onLanded = vi.fn()

    // The wait for an answer
    onceAnswerLands(queryClient, KEY, WRITES, onLanded)

    // A read landing somewhere else
    await queryClient.prefetchQuery({ queryKey: OTHER_KEY, queryFn: () => 'elsewhere' })

    // Nothing heard
    expect(onLanded).not.toHaveBeenCalled()
  })

  it('hears nothing once stopped', async () => {
    // A cache whose read of the answer is out
    const queryClient = new QueryClient()
    const { answer, read } = startRead(queryClient)

    // The callback the wait calls
    const onLanded = vi.fn()

    // The wait for an answer, stopped
    onceAnswerLands(queryClient, KEY, WRITES, onLanded)()

    // The read's answer arriving
    answer('landed')

    // The read, settled
    await read

    // Nothing heard
    expect(onLanded).not.toHaveBeenCalled()
  })
})
