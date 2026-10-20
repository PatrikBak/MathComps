import { type RefObject, useRef } from 'react'

import type { TableSort } from '@/components/shared/utils/table-sort'
import { useResortableOrder } from '@/hooks/use-resortable-order'
import { useShowFromTop } from '@/hooks/use-show-from-top'

import type { BoardRow, SortBy } from '../model/grading-board'

/**
 * Options for {@link useHeldRows}.
 */
type UseHeldRowsOptions = {
  /** The rows of the competition on screen, in the order asked for. */
  rows: BoardRow[]
  /** The round that is the competition on screen; null while there is none. */
  roundId: string | null
  /** How the rows are ordered. */
  sort: TableSort<SortBy>
}

/**
 * What {@link useHeldRows} hands back.
 */
type UseHeldRowsResult = {
  /** The rows on show, each where it stood when their order was last set. */
  rows: BoardRow[]
  /** Whether the latest read puts the rows in another order, or brings a student who isn't shown yet. */
  isOutOfOrder: boolean
  /** Shows the rows as the latest read has them, from the top of the grid. */
  showLatest: () => void
  /** The grid, whose top comes back into view. */
  gridRef: RefObject<HTMLDivElement | null>
  /** The line over the grid, which takes the focus as the way to show the latest rows leaves. */
  progressRef: RefObject<HTMLParagraphElement | null>
}

/**
 * The board's rows, held where they stood so nothing moves under the grader while the board is read again. Their
 * order is set as a competition comes on screen, as the grader picks another order, and when they ask. A student
 * writing for the first time waits until then, unless the board has shown nobody since its order was set.
 *
 * @param options - The rows, the competition on screen and the order asked for.
 *
 * @returns The rows as they show, whether newer ones wait, and the way to show them.
 */
export function useHeldRows({ rows, roundId, sort }: UseHeldRowsOptions): UseHeldRowsResult {
  // The line over the grid
  const progressRef = useRef<HTMLParagraphElement>(null)

  // The rows, each kept where it stood when their order was last set, a newcomer kept back until then
  const { shown, isOutOfOrder, resort } = useResortableOrder({
    items: rows,
    keyOf: (row) => row.user.id,
    // The order set again as another competition comes on screen and as another order is asked for
    resetKey: JSON.stringify([roundId, sort]),
    newcomerPlace: 'waiting',
  })

  // The grid, and the way to show the latest rows from its top, the focus on the line over it
  const { listRef: gridRef, showFromTop: showLatest } = useShowFromTop({
    show: resort,
    focusTarget: progressRef,
  })

  // The rows as they show, whether newer ones wait, and the way to show them
  return { rows: shown, isOutOfOrder, showLatest, gridRef, progressRef }
}
