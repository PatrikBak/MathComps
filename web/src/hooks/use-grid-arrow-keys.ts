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

/** The selector matching a menu a grid can stand in. */
const MENU_SELECTOR = '[role="menu"]'

/** The selector matching the items of a menu that take the focus. */
const FOCUSABLE_MENU_ITEM_SELECTOR = '[role^="menuitem"]:not([data-disabled])'

/**
 * Moves the focus off a grid standing among other items of a menu, onto the menu's item just before the grid or just
 * after it. A grid with nothing past that edge, or in no menu, keeps the focus.
 *
 * @param gridItems - The grid's items.
 * @param from - The item the arrow was pressed on.
 * @param rows - Which way the arrow points, negative for up.
 */
function focusBesideGrid(gridItems: ReadonlySet<HTMLElement>, from: Element, rows: number): void {
  // Every item of the menu holding the grid that takes the focus, in the order they stand
  const menuItems = [
    ...(from.closest(MENU_SELECTOR)?.querySelectorAll<HTMLElement>(FOCUSABLE_MENU_ITEM_SELECTOR) ??
      []),
  ]

  // Where the grid starts among them
  const first = menuItems.findIndex((item) => gridItems.has(item))

  // And where it ends
  const last = menuItems.findLastIndex((item) => gridItems.has(item))

  // The focus on the menu's item past the grid's edge the arrow points across, where there is one
  menuItems[rows < 0 ? first - 1 : last + 1]?.focus()
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
 * Arrow keys moving the focus across items laid out in rows: left and right along a row, up and down to the row
 * beside, landing on its last item where that row is shorter. An arrow pointing past the grid's left or right edge
 * keeps the focus where it is. Past its top or bottom, it goes on to the item before or after the grid in the menu
 * holding it, and keeps the focus where the grid stands alone. Every other key is left to the items.
 *
 * @param rowLengths - How many items each row holds.
 *
 * @returns The refs the items take, and the way their keys move the focus.
 */
export function useGridArrowKeys(rowLengths: readonly number[]): UseGridArrowKeysResult {
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

    // Any other key is the items' own
    if (step === undefined) return

    // The arrow is the grid's, even where no item lies that way
    event.preventDefault()

    // The row the arrow points at
    const targetRow = row + step.rows

    // How many items it holds, none past the grid's top or bottom
    const targetLength = rowLengths[targetRow]

    // Off the grid's top or bottom, on to the menu's item beside it, where the grid stands in a menu
    if (targetLength === undefined) {
      return focusBesideGrid(new Set(items.current.values()), event.currentTarget, step.rows)
    }

    // The item the arrow points at, the row's last where it is shorter
    const targetColumn = Math.min(column + step.columns, targetLength - 1)

    // The focus on it, where there is one
    items.current.get(gridKey(targetRow, targetColumn))?.focus()
  }

  // The refs the items take, and the way their keys move the focus
  return { itemRef, moveFocus }
}
