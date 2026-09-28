import { useCallback, useState } from 'react'

import { canStepFrom, describePosition, type SelectionPosition, stepTarget } from '@/lib/stepping'

/**
 * What {@link useSteppedSelection} hands back.
 */
export type UseSteppedSelectionResult = {
  /** The item open; null while none is. */
  openId: string | null
  /** Where the open item sits in the list; null while none is open or it sits outside the list. */
  position: SelectionPosition | null
  /** Opens one item. */
  open: (id: string) => void
  /** Closes whichever is open. */
  close: () => void
  /** Moves one place forward or back, staying put where there is nowhere to go. */
  step: (delta: 1 | -1) => void
  /** Whether there is an item one place forward or back to move to. */
  canStep: (delta: 1 | -1) => boolean
}

/**
 * Holds which item of a list is open, and walks the list from it.
 *
 * Where each move lands is worked out in {@link stepTarget} and its neighbours.
 *
 * @param orderedIds - Every listed item's id, in the order the list shows them.
 * @param initialOpenId - The item open when the list is first shown; null for none.
 *
 * @returns The selection as described by {@link UseSteppedSelectionResult}.
 */
export function useSteppedSelection(
  orderedIds: string[],
  initialOpenId: string | null
): UseSteppedSelectionResult {
  // Which item is open
  const [openId, setOpenId] = useState<string | null>(initialOpenId)

  // A function which tells whether there is somewhere to step to
  const canStep = useCallback(
    (delta: 1 | -1) => canStepFrom(orderedIds, openId, delta),
    [orderedIds, openId]
  )

  // A function which moves along the list, staying put where the walk has run out
  const step = useCallback(
    (delta: 1 | -1) => {
      // Where the move lands
      const target = stepTarget(orderedIds, openId, delta)

      // Move there, unless the walk has run out
      if (target !== null) setOpenId(target)
    },
    [orderedIds, openId]
  )

  // A function which opens one item
  const open = useCallback((id: string) => setOpenId(id), [])

  // A function which closes whichever item is open
  const close = useCallback(() => setOpenId(null), [])

  // Where the open item sits in the list
  const position = describePosition(orderedIds, openId)

  // Which item is open, where it sits, and every way of moving off it
  return { openId, position, open, close, step, canStep }
}
