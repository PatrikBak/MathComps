import { type RefObject, useEffect } from 'react'

/**
 * Scrolls the standing option into view as a facet's list appears.
 *
 * A facet that leaves its options in the order they were authored in can open with the option
 * that stands sitting well below the fold, so the list is moved to it rather than it to the top
 * of the list.
 *
 * @param listRef - The scrolling list holding the option rows.
 * @param isActive - Whether the standing option is to be brought into view.
 * @param optionCount - How many rows the list holds, so that one opened ahead of its options still reveals.
 */
export function useRevealSelectedOption(
  listRef: RefObject<HTMLDivElement | null>,
  isActive: boolean,
  optionCount: number
) {
  // Bring the row over the fold once the list is up
  useEffect(() => {
    // Nothing to reveal until the list is up and the facet asks for it
    if (!isActive) return

    // Positioning settles the panel's height a tick after it mounts, and a list not yet cut off by one
    // cannot scroll to anything, so the move waits for the frame after
    const frame = window.requestAnimationFrame(() => {
      // The row that stands
      const checkedInput = listRef.current?.querySelector('input:checked')

      // A facet with nothing standing opens at the top of its list
      if (!checkedInput) return

      // Centred rather than merely brought over the edge, so what sits around it reads too
      checkedInput.scrollIntoView({ block: 'center' })
    })

    // A list going back down before the frame arrives has nothing left to scroll
    return () => window.cancelAnimationFrame(frame)
  }, [isActive, optionCount, listRef])
}
