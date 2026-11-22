'use client'

import { useIsomorphicEffect } from '@mantine/hooks'
import { useCallback, useRef, useState } from 'react'

import {
  areRowMeasuresEqual,
  fitRow,
  placeRowWidths,
  type RowControls,
  type RowMeasures,
} from '@/components/shared/utils/row-fit'

/**
 * How many controls keep their place on a row, and the callback ref that measures it.
 */
type UseFittedRowResult<TRow extends HTMLElement> = {
  /** Attaches the row the controls stand on, as the callback ref it is rendered with. */
  attachRow: (row: TRow) => () => void
  /** How many of the controls that can leave the row keep their place on it, counted from the first. */
  visibleCount: number
}

/**
 * Keeps a row of controls of any widths on one line: the pinned ones at the end, and as many of the others as fit
 * beside them, counted from the first. The caller renders that many of the controls that can leave, then the pinned
 * ones, and offers the rest elsewhere, such as in a menu beside the row.
 *
 * The row holds the controls and nothing else, takes whatever width its line leaves it rather than the width of
 * what it holds, and clips what overflows it, since a frame can be painted before the row catches up with a new
 * width. Each control's width is remembered from the last time it stood on the row.
 *
 * @param controls - How many controls there are, and how many at the end are pinned.
 * @returns The row's callback ref, and how many of the controls keep their place.
 */
export function useFittedRow<TRow extends HTMLElement>({
  itemCount,
  pinnedCount,
}: RowControls): UseFittedRowResult<TRow> {
  // What the row has measured of itself, nothing until it is on screen
  const [measures, setMeasures] = useState<RowMeasures | null>(null)

  // How many of the controls that can leave keep their place, given what the row has measured
  const visibleCount = fitRow(measures, { itemCount, pinnedCount })

  // Which controls are on screen: how many of the ones that can leave stand before the pinned ones
  const drawn = useRef({ visibleCount, itemCount, pinnedCount })

  // A function which measures the row on screen, null while none is
  const measureRow = useRef<(() => void) | null>(null)

  // A function which attaches the row, as the callback ref it is rendered with
  const attachRow = useCallback((row: TRow) => {
    // The controls already watched, so that a measuring watches each one once
    const watchedControls = new WeakSet<Element>()

    // Watches the row's width, and each control's, since a control can change its width on its own
    const observer = new ResizeObserver(() => measure())

    /**
     * Measures the row as it stands.
     */
    function measure() {
      // The row's padding, which is room the controls do not get, and the gap it keeps between them
      const { paddingLeft, paddingRight, columnGap } = getComputedStyle(row)

      // The width the row has for its controls
      const room =
        row.getBoundingClientRect().width - parseFloat(paddingLeft) - parseFloat(paddingRight)

      // The controls on the row now
      const rowControls = [...row.children]

      // Which controls are on screen
      const onScreen = drawn.current

      // How wide each control on screen is, in the order they stand
      const drawnWidths = rowControls.map((control) => control.getBoundingClientRect().width)

      // Each control watched from now on, once
      rowControls
        .filter((control) => !watchedControls.has(control))
        .forEach((control) => {
          // Watched for its width
          observer.observe(control)

          // And not again
          watchedControls.add(control)
        })

      // The row's new measures stored, the old ones kept where nothing changed, so that a measuring changing nothing
      // renders nothing
      setMeasures((current) => {
        // Every control's width: the ones on screen as measured now, the ones off it as last measured
        const widths = placeRowWidths(drawnWidths, onScreen, current?.widths ?? null)

        // The measures as they now stand
        const next: RowMeasures = { room, gap: parseFloat(columnGap) || 0, widths }

        // The new measures where something moved, the stored ones otherwise
        return current !== null && areRowMeasuresEqual(current, next) ? current : next
      })
    }

    // This row is now the one on screen to measure
    measureRow.current = measure

    // Measured as the row lands, which is before it is first painted
    measure()

    // And watched for its width from then on
    observer.observe(row)

    // What React runs once the row goes
    return () => {
      // Nothing is left to watch
      observer.disconnect()

      // Nor a row to measure
      measureRow.current = null
    }
  }, [])

  // A new set of controls on screen is measured before it is painted, so that one frame never shows controls the
  // row has no room for
  useIsomorphicEffect(() => {
    // The controls now on screen
    drawn.current = { visibleCount, itemCount, pinnedCount }

    // Measured as they stand
    measureRow.current?.()
  }, [visibleCount, itemCount, pinnedCount])

  // The row's callback ref, and how many controls keep their place
  return { attachRow, visibleCount }
}
