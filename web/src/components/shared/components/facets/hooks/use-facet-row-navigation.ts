import { type KeyboardEvent, type RefObject, useRef } from 'react'

import { isFacetNavigationKey, nextFocusedOptionIndex } from '../model/facet-logic'

/** Marks an element as one of the rows focus walks, and carries which row it is. */
const FACET_ROW_ATTRIBUTE = 'data-facet-row-id'

/** The rows themselves, whichever element each facet hangs the mark on. */
const FACET_ROW_SELECTOR = `[${FACET_ROW_ATTRIBUTE}]`

/** The key advancing the focused section to its next ordering. */
const SORT_KEY = 's'

/** Tells a heading's row id apart from an option's, the two being drawn from separate namings. */
const HEADING_ROW_PREFIX = 'heading:'

/**
 * What a key asks of the row focus sits on, beyond moving off it.
 */
export type FacetRowAction = 'collapse' | 'expand' | 'cycle-sort'

/**
 * Names the row a section's heading is drawn as.
 *
 * @param groupKey - The section.
 * @returns Its row id.
 */
export function headingRowId(groupKey: string): string {
  // Marked, since an option could carry the same name as a section and mean something else entirely
  return `${HEADING_ROW_PREFIX}${groupKey}`
}

/**
 * Reads which section a row heads.
 *
 * @param rowId - The row.
 * @returns The section it heads, or nothing where the row is an option.
 */
export function headingKeyOf(rowId: string): string | undefined {
  // An option's row id is its own, so anything unmarked is one
  if (!rowId.startsWith(HEADING_ROW_PREFIX)) return undefined

  // What is left once the mark is taken off is the section itself
  return rowId.slice(HEADING_ROW_PREFIX.length)
}

/**
 * What a facet lets its rows do beyond being walked.
 */
export type UseFacetRowNavigationConfig = {
  /**
   * Applies an action to a row, answering whether it did anything. A row with nothing to collapse, or a
   * facet with no orderings to cycle, answers no and the key goes back to the browser rather than being
   * swallowed by a handler with no use for it.
   */
  onRowAction: (rowId: string, action: FacetRowAction) => boolean
}

/**
 * The ref and handlers walking keyboard focus through a facet's rows.
 */
export type UseFacetRowNavigationResult = {
  /** The scrolling list element, whose rows are what focus moves between. */
  listRef: RefObject<HTMLDivElement | null>
  /** Moves focus to the top of the list. */
  focusFirstRow: () => void
  /** Handles the keys the list takes over. */
  onListKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/**
 * Makes a facet's panel one stop on the page's tab order, walked from the inside by the arrows.
 *
 * Every row is a stop of its own to the browser: a checkbox each, and a heading button per section. Left
 * to that, a facet of forty options is forty stops in the middle of the page, and the same facet drawn
 * with radios is one, since a radio group is one stop by the platform's rule. Walking the rows here and
 * leaving only one of them in the tab order is what makes every facet behave the same.
 *
 * The row focus sits on is read from the document rather than from the event, since the keypress arrives
 * at the list holding every row while only the focused one is being acted on.
 *
 * @param config - What the facet's own rows can do.
 * @returns The ref and handlers described by {@link UseFacetRowNavigationResult}.
 */
export function useFacetRowNavigation({
  onRowAction,
}: UseFacetRowNavigationConfig): UseFacetRowNavigationResult {
  // The scrolling list
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * Collects the rows focus can move between.
   *
   * @returns The rendered rows, in document order.
   */
  function rowElements(): HTMLElement[] {
    // Whatever each facet marked as a row, which a closed popover has none of
    const marked = listRef.current?.querySelectorAll<HTMLElement>(FACET_ROW_SELECTOR)

    // An empty list is a legitimate result rather than an error
    return Array.from(marked ?? [])
  }

  /**
   * Reads which row focus is on.
   *
   * @returns The focused row's id, or nothing while focus sits elsewhere in the panel.
   */
  function focusedRowId(): string | undefined {
    // The mark is on the row's own element, so focus has to be sitting on it
    if (!(document.activeElement instanceof HTMLElement)) return undefined

    // Absent while focus is on the search box, the reset button, or the panel itself
    return document.activeElement.getAttribute(FACET_ROW_ATTRIBUTE) ?? undefined
  }

  /** Hands focus to the top of the list. */
  function focusFirstRow() {
    // Scrolling is suppressed so a keyboard handoff doesn't yank the popover around
    rowElements()[0]?.focus({ preventScroll: true })
  }

  /**
   * Answers a key the focused row itself acts on, rather than one that moves off it.
   *
   * @param event - The keypress, whose key decides which action is asked for.
   * @returns Whether the row acted, which is what decides who keeps the key.
   */
  function applyRowAction(event: KeyboardEvent<HTMLDivElement>): boolean {
    // Which of the row's own actions the key asks for, if any
    const action = rowActionForKey(event.key)

    // Everything else is the walk down the rows
    if (!action) return false

    // The row being asked, absent while focus sits elsewhere in the panel
    const rowId = focusedRowId()

    // With no row under focus there is nothing to act on
    if (!rowId) return false

    // The facet decides, since only it knows whether this row has a section or a branch behind it
    return onRowAction(rowId, action)
  }

  /**
   * Moves focus by one row, one page, or to either end of the list.
   *
   * @param event - The keypress, whose key decides how far focus travels.
   */
  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The search box owns its own keys, so typing in it is left alone
    if (event.target instanceof HTMLInputElement && event.target.type === 'text') return

    // A key the focused row answered itself is spoken for and travels no further
    if (applyRowAction(event)) {
      event.preventDefault()
      return
    }

    // Anything outside the navigation set keeps whatever the browser does with it
    if (!isFacetNavigationKey(event.key)) return

    // The rows focus can move between
    const rows = rowElements()

    // A list a search left empty has nowhere to move focus to, and the key stays the browser's so
    // the page still answers it
    if (rows.length === 0) return

    // From here the hook moves focus itself, so the browser's own handling of the key is dropped
    event.preventDefault()

    // Which row holds focus, or -1 while it sits on something else inside the panel
    const focusedIndex = rows.findIndex((row) => row === document.activeElement)

    // The row the key picked
    const nextRow = rows[nextFocusedOptionIndex(event.key, focusedIndex, rows.length)]

    // Scrolling is suppressed here too, since the row is brought into view deliberately below
    nextRow?.focus({ preventScroll: true })

    // Focus alone would leave a row below the fold invisible, so bring it into the list
    nextRow?.scrollIntoView({ block: 'nearest' })
  }

  // The list element to bind, and the two handlers that drive focus around it
  return { listRef, focusFirstRow, onListKeyDown }
}

/**
 * Reads which of a row's own actions a key asks for.
 *
 * @param key - The key pressed.
 * @returns The action, or nothing for a key the rows have no claim on.
 */
function rowActionForKey(key: string): FacetRowAction | undefined {
  // The keys a row claims for itself, the rest belonging to the walk between rows
  switch (key) {
    // Left rolls up whatever the row heads
    case 'ArrowLeft':
      return 'collapse'

    // Right unrolls it
    case 'ArrowRight':
      return 'expand'

    // And the ordering sits on a letter, the sections having taken both arrows
    case SORT_KEY:
    case SORT_KEY.toUpperCase():
      return 'cycle-sort'

    // Every other key belongs to the walk, or to the browser
    default:
      return undefined
  }
}
