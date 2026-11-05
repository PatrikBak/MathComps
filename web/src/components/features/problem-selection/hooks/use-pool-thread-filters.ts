'use client'

import { useAuth } from '@clerk/nextjs'
import { useDebouncedCallback, usePrevious } from '@mantine/hooks'
import { useEffect, useRef } from 'react'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { discussionPartsIn } from '../model/seen-marks'
import {
  type DiscussedSubject,
  type DiscussionThread,
  revealedIn,
} from '../model/selection-discussions'
import type { UsePoolFiltersResult } from './use-pool-filters'
import type { UseSelectionDiscussionsResult } from './use-selection-discussions'

/** How long what the threads are narrowed to stays as it is before the server is told what a change shows afresh. */
const FILTERS_REST_MS = 500

/**
 * What {@link usePoolThreadFilters} works over.
 */
type UsePoolThreadFiltersOptions = {
  /**
   * The threads the filters let through, in the order they are held in, each under its subject as the selection now
   * holds it; null until the first read has landed.
   */
  threads: DiscussionThread<DiscussedSubject>[] | null
  /** The threads the filters keep out. */
  hidden: DiscussionThread<DiscussedSubject>[]
  /** The key of what the threads are narrowed to: the filter, with the board while they follow it. */
  filterKey: string
  /** Shows the discussions asked for as the latest read found them. */
  showLatest: UseSelectionDiscussionsResult['showNews']
}

/**
 * The pool's filters as its threads are narrowed through them. A change made through them takes everything waiting
 * into every discussion. Once what the threads are narrowed to rests, however it changed, the server is told what it
 * shows afresh was seen, as {@link revealedIn} reads it.
 *
 * @param options - The threads, what they are narrowed to, and the way to show what waits.
 *
 * @returns The filter, and the ways of changing it.
 */
export function usePoolThreadFilters({
  threads,
  hidden,
  filterKey,
  showLatest,
}: UsePoolThreadFiltersOptions): UsePoolFiltersResult {
  // What the pool is narrowed to with the ways of changing it, and what the reader has seen
  const { poolFilters, seenMarks } = useSelectionWorkspace()

  // The reader
  const { userId } = useAuth()

  // The threads the filters let through, none until the first read has landed
  const letThrough = threads ?? []

  // The threads let through before what they are narrowed to began changing, which what the change shows afresh is
  // told against once it rests; null while no change waits to be told
  const heldBeforeChange = useRef<DiscussionThread<DiscussedSubject>[] | null>(null)

  // A function which tells the server what the threads show afresh over those let through before what they are
  // narrowed to began changing, once it rests, so what shows only between two keystrokes of a search is never told
  const tellRevealed = useDebouncedCallback(
    () => {
      // The threads let through before the change
      const before = heldBeforeChange.current

      // Nothing waits to be told
      if (before === null) return

      // The change told
      heldBeforeChange.current = null

      // The server told what the change shows afresh was seen, short of what is new in the threads the filters hide
      seenMarks.visits?.tellSeen(
        discussionPartsIn({ shown: revealedIn(before, letThrough), hidden }, userId ?? null)
      )
    },
    { delay: FILTERS_REST_MS, flushOnUnmount: true }
  )

  // A function which takes everything waiting into every discussion as the reader narrows the threads afresh, telling
  // the server what they then show afresh once things rest, even where the change leaves the filter's key as it was
  const takeIn = () => {
    // The threads let through before the change, unless an earlier change still waits to be told against them
    heldBeforeChange.current ??= letThrough

    // Everything waiting taken in
    showLatest({ targets: null, seen: null })

    // What the change shows afresh told once things rest
    tellRevealed()
  }

  // The key of what the threads were narrowed to when the last change to it was counted as told
  const toldUnder = useRef(filterKey)

  // The threads let through as the last render on screen had them; undefined before the first
  const previousThreads = usePrevious(threads)

  // What a change to what the threads are narrowed to shows afresh, told once things rest, however it came: a pick, a
  // step through history or another board on screen among them
  useEffect(() => {
    // Nothing changed since it was last told
    if (toldUnder.current === filterKey) return

    // The change counted as told
    toldUnder.current = filterKey

    // Nothing shown before the change, so nothing to tell what it shows afresh against
    if (previousThreads === undefined || previousThreads === null) return

    // The threads let through before the change, unless an earlier change still waits to be told against them
    heldBeforeChange.current ??= previousThreads

    // What the change shows afresh told once things rest
    tellRevealed()
  }, [filterKey, previousThreads, tellRevealed])

  // A function which replaces one field of the filter, everything waiting taken in first
  const setField: UsePoolFiltersResult['setField'] = (field, value) => {
    // Everything waiting taken in
    takeIn()

    // The field replaced
    poolFilters.setField(field, value)
  }

  // A function which opens every filter back up, everything waiting taken in first
  const clearAll = () => {
    // Everything waiting taken in
    takeIn()

    // Every filter opened
    poolFilters.clearAll()
  }

  // What the threads are narrowed to
  const { filter } = poolFilters

  // The filter and the ways of changing it, each change taking in everything waiting first
  return { filter, setField, clearAll }
}
