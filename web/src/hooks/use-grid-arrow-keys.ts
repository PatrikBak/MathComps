'use client'

import { type KeyboardEvent, type RefCallback, useRef } from 'react'

/**
 * How far an arrow key moves the focus across a grid.
 */
type GridStep = {
  /** Rows down, negative for up. */
  rows: number
  /** Items along the row, negative for back. */
  columns: number
}

/** Each arrow key's step across a grid: along the row for left and right, to the row beside for up and down. */
const GRID_STEPS: Readonly<Record<string, GridStep | undefined>> = {
  ArrowUp: { rows: -1, columns: 0 },
  ArrowDown: { rows: 1, columns: 0 },
  ArrowLeft: { rows: 0, columns: -1 },
  ArrowRight: { rows: 0, columns: 1 },
}

/**
 * Names one item of a grid by its row and its place in the row.
 *
 * @param row - The item's row, from zero.
 * @param column - The item's place in the row, from zero.
 *
 * @returns The item's name in the grid.
 */
function gridKey(row: number, column: number): string {
  // The two positions together
  return `${row}:${column}`
}

/**
 * Options for {@link useGridArrowKeys}.
 */
type UseGridArrowKeysOptions = {
  /** How many items each row holds. */
  rowLengths: readonly number[]
  /** Whether up and down step to the row beside; where they don't, both keys are left to the items. */
  stepsBetweenRows: boolean
}

/**
 * Return type for {@link useGridArrowKeys}.
 */
type UseGridArrowKeysResult = {
  /** The ref for the item at a row and a place in it, which the arrow keys can then focus. */
  itemRef: (row: number, column: number) => RefCallback<HTMLElement>
  /** Moves the focus from the item at a row and a place in it to the item an arrow key points at. */
  moveFocus: (event: KeyboardEvent, row: number, column: number) => void
}

/**
 * Arrow keys moving the focus across items laid out in rows: left and right along a row, and, where the grid steps
 * between rows, up and down to the row beside, landing on its last item where that row is shorter. An arrow
 * pointing past the grid's edge keeps the focus where it is, and every other key is left to the items.
 *
 * @param options - The grid's rows, and whether up and down step between them.
 *
 * @returns The refs the items take, and the way their keys move the focus.
 */
export function useGridArrowKeys({
  rowLengths,
  stepsBetweenRows,
}: UseGridArrowKeysOptions): UseGridArrowKeysResult {
  // Every item standing, by its name in the grid
  const items = useRef(new Map<string, HTMLElement>())

  // A function which makes the ref for the item at a row and a place in it
  const itemRef =
    (row: number, column: number): RefCallback<HTMLElement> =>
    (item) => {
      // No item to keep
      if (item === null) return

      // The item, kept while it stands
      items.current.set(gridKey(row, column), item)

      // And dropped once it goes
      return () => {
        items.current.delete(gridKey(row, column))
      }
    }

  // A function which moves the focus to the item an arrow key points at
  const moveFocus = (event: KeyboardEvent, row: number, column: number) => {
    // How far the key moves the focus, for an arrow key
    const step = GRID_STEPS[event.key]

    // Any other key is the items' own, and so are up and down where the grid keeps to its rows
    if (step === undefined || (!stepsBetweenRows && step.rows !== 0)) return

    // The arrow is the grid's, even where no item lies that way
    event.preventDefault()

    // The row the arrow points at
    const targetRow = row + step.rows

    // How many items it holds, none past either edge of the grid
    const targetLength = rowLengths[targetRow] ?? 0

    // The item the arrow points at, the row's last where it is shorter
    const targetColumn = Math.min(column + step.columns, targetLength - 1)

    // The focus on it, where there is one
    items.current.get(gridKey(targetRow, targetColumn))?.focus()
  }

  // The refs the items take, and the way their keys move the focus
  return { itemRef, moveFocus }
}
