import { type FocusEvent, type KeyboardEvent, type RefObject, useRef } from 'react'

import { dataAttribute } from '@/components/shared/utils/dom-utils'
import { focusForReader } from '@/components/shared/utils/focus-utils'
import { useKeyedState } from '@/hooks/use-keyed-state'

import { isFacetNavigationKey, nextFocusedOptionIndex, rowActionForKey } from '../model/facet-logic'
import type { FacetRowActionHandler } from '../model/facet-types'

/** Marks an element as one of the rows focus walks, and carries which row it is. */
export const FACET_ROW_ATTRIBUTE = dataAttribute('data-facet-row-id')

/**
 * Hands focus to a row the reader pressed, where focus sits on another row, so the keys go on from the row the
 * pointer last reached. A press that rolls the focused row away hands focus to the row doing it the same way, which
 * keeps focus in the panel and the keys walking its rows. Focus anywhere else stays where it is, the caret in the
 * search box above all.
 *
 * @param row - The row pressed.
 */
export function followPressFromRow(row: HTMLElement) {
  // Whether focus sits on one of the rows, rather than in the search box or anywhere else
  const isFocusOnRow = document.activeElement?.hasAttribute(FACET_ROW_ATTRIBUTE.name) ?? false

  // Focus off the rows stays put
  if (!isFocusOnRow) return

  // Onto the row pressed
  focusForReader(row, { preventScroll: true })
}

/**
 * What a facet's row navigation runs on.
 */
export type UseFacetRowNavigationConfig = {
  /** Whether the panel is open, each opening handing the tab stop back to the row the facet itself picks. */
  isOpen: boolean
  /** What the facet's rows do with the keys they act on themselves, {@link FacetRowActionHandler}. */
  onRowAction: FacetRowActionHandler
}

/**
 * The list's ref, the row focus last landed on, and the handlers walking keyboard focus through a facet's rows.
 */
export type UseFacetRowNavigationResult = {
  /** The scrolling list element, whose rows are what focus moves between. */
  listRef: RefObject<HTMLDivElement | null>
  /** The row focus last landed on, while focus stays inside the list. */
  lastFocusedRowId: string | null
  /** Moves focus to the top of the list. */
  focusFirstRow: () => void
  /** Notes the row focus lands on, wherever inside the list it lands. */
  onListFocus: (event: FocusEvent<HTMLDivElement>) => void
  /** Forgets the row focus last landed on once focus leaves the list. */
  onListBlur: (event: FocusEvent<HTMLDivElement>) => void
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
 * The stop travels with focus while focus stays inside the list, so Tab and Shift+Tab leave the list from the
 * row the arrows reached. Once focus leaves the list the stop goes back to the row the facet picks, since
 * Firefox and Safari let Tab into a radio group only at its checked radio.
 *
 * The row focus sits on is read from the document rather than from the event, since the keypress arrives
 * at the list holding every row while only the focused one is being acted on.
 *
 * @param config - What the navigation runs on.
 * @returns The navigation described by {@link UseFacetRowNavigationResult}.
 */
export function useFacetRowNavigation({
  isOpen,
  onRowAction,
}: UseFacetRowNavigationConfig): UseFacetRowNavigationResult {
  // The scrolling list
  const listRef = useRef<HTMLDivElement>(null)

  // The row focus last landed on, forgotten once focus leaves the list and each time the panel opens or closes
  const [lastFocusedRowId, setLastFocusedRowId] = useKeyedState<string | null>(isOpen, null)

  /**
   * Collects the rows focus can move between.
   *
   * @returns The rendered rows, in document order.
   */
  function rowElements(): HTMLElement[] {
    // Whatever each facet marked as a row, which a closed popover has none of
    const marked = listRef.current?.querySelectorAll<HTMLElement>(FACET_ROW_ATTRIBUTE.anySelector)

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
    return document.activeElement.getAttribute(FACET_ROW_ATTRIBUTE.name) ?? undefined
  }

  /**
   * Notes the row focus has landed on, however it got there.
   *
   * @param event - Focus arriving somewhere inside the list.
   */
  function onListFocus(event: FocusEvent<HTMLDivElement>) {
    // The row focus landed on, absent where it landed on a control beside one
    const rowId = event.target.getAttribute(FACET_ROW_ATTRIBUTE.name)

    // Note a row, a control beside one leaving the stop with the row before it
    if (rowId !== null) setLastFocusedRowId(rowId)
  }

  /**
   * Lets go of the row focus was on once focus leaves the list, so the way back in is the row the facet picks.
   *
   * @param event - Focus leaving somewhere inside the list.
   */
  function onListBlur(event: FocusEvent<HTMLDivElement>) {
    // Focus staying inside the list, on a row or a control beside one, keeps the stop
    if (event.currentTarget.contains(event.relatedTarget)) return

    // Anywhere else, and the stop goes back to the row the facet picks
    setLastFocusedRowId(null)
  }

  /** Hands focus to the top of the list. */
  function focusFirstRow() {
    // The top row, brought back into view where the list was scrolled away from it
    showRow(rowElements()[0])
  }

  /**
   * Answers a key the focused row itself acts on, rather than one that moves off it.
   *
   * @param event - The keypress, whose key decides which action is asked for.
   * @returns Whether the row acted, which is what decides who keeps the key.
   */
  function applyRowAction(event: KeyboardEvent<HTMLDivElement>): boolean {
    // A key held with a modifier stays the browser's, Alt+Left and Cmd+Left going back a page
    if (event.altKey || event.ctrlKey || event.metaKey) return false

    // Which of the row's own actions the key asks for, if any
    const action = rowActionForKey(event.key)

    // Everything else is the walk down the rows
    if (!action) return false

    // The row being asked, absent while focus sits elsewhere in the panel
    const rowId = focusedRowId()

    // With no row under focus there is nothing to act on
    if (!rowId) return false

    // The facet decides, since only it knows whether this row has a section or a branch behind it
    return onRowAction(rowId, action, focusRow)
  }

  /**
   * Moves focus onto one of the rows by its id.
   *
   * @param rowId - The row to move to.
   */
  function focusRow(rowId: string) {
    // The row the facet named, where the list draws it
    showRow(listRef.current?.querySelector<HTMLElement>(FACET_ROW_ATTRIBUTE.selectorFor(rowId)))
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

    // Onto the row the key picked
    showRow(rows[nextFocusedOptionIndex(event.key, focusedIndex, rows.length)])
  }

  // The list element to bind, the row carrying the stop, and the handlers that drive focus around it
  return { listRef, lastFocusedRowId, focusFirstRow, onListFocus, onListBlur, onListKeyDown }
}

/**
 * Puts focus on a row and brings it into the list's view.
 *
 * @param row - The row, absent where the list draws none to move to.
 */
function showRow(row: HTMLElement | null | undefined) {
  // Scrolling is suppressed so the popover isn't yanked around, the row being brought into view deliberately below
  focusForReader(row ?? null, { preventScroll: true })

  // Focus alone would leave a row below the fold invisible, so bring it into the list
  row?.scrollIntoView({ block: 'nearest' })
}
