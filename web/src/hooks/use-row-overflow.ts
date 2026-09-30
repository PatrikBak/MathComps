'use client'

import { useIsomorphicEffect } from '@mantine/hooks'
import { useCallback, useRef, useState } from 'react'

/**
 * Return type for the {@link useRowOverflow} hook.
 */
type UseRowOverflowResult<TRow extends HTMLElement> = {
  /** Attaches the row the items stand on, as the callback ref it is rendered with. */
  attachRow: (row: TRow) => () => void
  /** How many of the items keep their place on the row, counted from the first. */
  visibleCount: number
  /** Whether the element beside the row is to stand at its narrower width. */
  isNeighbourCompact: boolean
}

/**
 * What a row has room for on its one line.
 */
type RowRoom = {
  /** How many equal slots the row holds as it stands. */
  capacity: number
  /** How many equal slots the row would hold with the element beside it at its full width. */
  capacityBesideFullNeighbour: number
}

/**
 * Counts the equal slots a width holds.
 *
 * @param width - The width to fill.
 * @param slotWidth - How wide one slot is.
 * @param gap - The space kept between neighbouring slots.
 *
 * @returns The count.
 */
function slotsIn(width: number, slotWidth: number, gap: number): number {
  // A run of n slots is n widths and one gap fewer
  return Math.floor((width + gap) / (slotWidth + gap))
}

/**
 * Measures what a row has room for.
 *
 * @param row - The row, whose first child says how wide a slot is.
 * @param fullNeighbourWidth - How wide the element beside the row stands at its full width, zero for a
 *   row alone on its line.
 *
 * @returns The room, or null for a row with nothing on it to measure.
 */
function roomOf(row: HTMLElement, fullNeighbourWidth: number): RowRoom | null {
  // The slot every other one matches
  const slot = row.firstElementChild

  // The line the row shares with its neighbour
  const line = row.parentElement

  // Nothing on the row, nothing laid out yet, or no line around the row
  if (!(slot instanceof HTMLElement) || slot.offsetWidth === 0 || line === null) return null

  // The space the row keeps between its slots
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0

  // The width the line has for everything on it, the same whichever width the neighbour stands at, so
  // the neighbour going narrow never changes the room that sent it narrow
  const { paddingLeft, paddingRight, columnGap } = getComputedStyle(line)
  const lineWidth = line.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight)

  // What of the line's width the neighbour takes at its full width, the space between the two included
  const neighbourShare =
    fullNeighbourWidth > 0 ? fullNeighbourWidth + (parseFloat(columnGap) || 0) : 0

  // The slots the row holds now, and the ones the full-width neighbour would leave it
  return {
    capacity: slotsIn(row.clientWidth, slot.offsetWidth, gap),
    capacityBesideFullNeighbour: slotsIn(lineWidth - neighbourShare, slot.offsetWidth, gap),
  }
}

/**
 * Keeps a row of equal-width items on one line: counts how many of them fit, and where they do not all
 * fit, gives one slot up to the control that opens the rest. The caller renders that many items, then
 * the control, and lists what is left behind it.
 *
 * The row is a flex row whose children are all one width, the control included, and which clips what
 * overflows it, since a frame can be painted before the count catches up with the row's width. It takes
 * whatever width its line has to spare.
 *
 * The line may hold one more element, after the row, with a narrower width to fall back to. That
 * neighbour goes narrow before any item leaves the row: the caller renders it at full width until told
 * otherwise, and items start leaving only where they do not fit beside the narrow one either.
 *
 * @param itemCount - How many items there are to place.
 *
 * @returns The row's callback ref, the number of items that keep their place, and whether its neighbour
 *   is to go narrow.
 */
export function useRowOverflow<TRow extends HTMLElement>(
  itemCount: number
): UseRowOverflowResult<TRow> {
  // What the row has room for, unknown until it is on screen
  const [room, setRoom] = useState<RowRoom | null>(null)

  // A function which measures the row on screen, null while none is
  const measureRow = useRef<(() => void) | null>(null)

  /**
   * A function which attaches the row, as the callback ref it is rendered with.
   *
   * @param row - The row the items stand on.
   *
   * @returns What React runs once the row goes.
   */
  const attachRow = useCallback((row: TRow) => {
    // The neighbour's full width, which is the widest it has stood, since it starts out at that
    let fullNeighbourWidth = 0

    // A function which measures the row as it stands
    const measure = () => {
      // The element beside the row, and how wide it stands now
      const neighbour = row.nextElementSibling
      const neighbourWidth = neighbour instanceof HTMLElement ? neighbour.offsetWidth : 0

      // The neighbour's full width, which it may have grown past since it last stood at it
      fullNeighbourWidth = Math.max(fullNeighbourWidth, neighbourWidth)

      // The room the row has beside the neighbour
      const measured = roomOf(row, fullNeighbourWidth)

      // The room is kept only where it differs, so that a width changing nothing renders nothing
      setRoom((current) =>
        current?.capacity === measured?.capacity &&
        current?.capacityBesideFullNeighbour === measured?.capacityBesideFullNeighbour
          ? current
          : measured
      )
    }

    // This row is now the one on screen to measure
    measureRow.current = measure

    // Measured as the row lands, which is before it is first painted
    measure()

    // Measured again whenever the row's width changes
    const observer = new ResizeObserver(measure)
    observer.observe(row)

    // What React runs once the row goes
    return () => {
      // Nothing is left to watch
      observer.disconnect()

      // Nor a row to measure
      measureRow.current = null
    }
  }, [])

  // Whether the neighbour goes narrow, which it does only on a measured row whose items do not all fit
  // beside it at full width
  const isNeighbourCompact = room !== null && itemCount > room.capacityBesideFullNeighbour

  // Whether every item keeps its place: beside the full-width neighbour, or in the room its going
  // narrow made
  const visibleCount =
    !isNeighbourCompact || itemCount <= room.capacity
      ? // Every item keeps its place
        itemCount
      : // Or one slot goes to the control
        Math.max(room.capacity - 1, 0)

  // The neighbour changing width changes the row's, so the row is measured again before that is
  // painted. Left to the observer, one frame would show the count the row had room for earlier
  useIsomorphicEffect(() => measureRow.current?.(), [isNeighbourCompact])

  // The row's callback ref, how many items keep their place, and whether the neighbour goes narrow
  return { attachRow, visibleCount, isNeighbourCompact }
}
