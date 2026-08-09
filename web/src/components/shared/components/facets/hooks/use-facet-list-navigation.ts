import { type KeyboardEvent, type RefObject, useRef } from 'react'

import { isFacetNavigationKey, nextFocusedOptionIndex } from '../model/facet-logic'

/** The row controls focus moves between, whichever of them the facet's selection mode draws. */
const OPTION_INPUT_SELECTOR = 'input[type="checkbox"], input[type="radio"]'

/**
 * The ref and handlers walking keyboard focus through a facet's option list.
 */
export type UseFacetListNavigationResult = {
  /** The scrolling list element, whose row controls are what focus moves between. */
  listRef: RefObject<HTMLDivElement | null>
  /** Moves focus to the first option. */
  focusFirstItem: () => void
  /** Handles the arrow, home, end and page keys within the list. */
  onListKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/**
 * Lets the arrow, home, end and page keys walk a facet's options.
 *
 * Focus lands on the rows' real controls rather than on a roving tabindex, which leaves
 * Space and Enter to the browser and keeps the rows reachable by Tab.
 *
 * @returns The ref and handlers described by {@link UseFacetListNavigationResult}.
 */
export function useFacetListNavigation(): UseFacetListNavigationResult {
  // The scrolling list
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * Collects the options focus can move between.
   *
   * @returns The rendered option controls, in document order.
   */
  function optionInputs(): HTMLInputElement[] {
    // The controls standing in for the rows, in document order
    const inputs = listRef.current?.querySelectorAll<HTMLInputElement>(OPTION_INPUT_SELECTOR)

    // A closed popover has no list, which is a legitimate empty result rather than an error
    return Array.from(inputs ?? [])
  }

  /** Hands focus to the top of the list. */
  function focusFirstItem() {
    // Scrolling is suppressed so a keyboard handoff doesn't yank the popover around
    optionInputs()[0]?.focus({ preventScroll: true })
  }

  /**
   * Moves focus by one row, one page, or to either end of the list.
   *
   * @param event - The keypress, whose key decides how far focus travels.
   */
  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The search box owns its own keys, so typing in it is left alone
    if (event.target instanceof HTMLInputElement && event.target.type === 'text') return

    // Anything outside the navigation set keeps whatever the browser does with it
    if (!isFacetNavigationKey(event.key)) return

    // The hook moves focus itself, so the browser's own handling of the key is dropped
    event.preventDefault()

    // The rows focus can move between
    const items = optionInputs()

    // An empty list has nowhere to move focus to
    if (items.length === 0) return

    // Which row holds focus, or -1 while it sits on something else inside the list
    const focusedIndex = items.findIndex((item) => item === document.activeElement)

    // The row the key picked
    const nextItem = items[nextFocusedOptionIndex(event.key, focusedIndex, items.length)]

    // Scrolling is suppressed here too, since the row is brought into view deliberately below
    nextItem?.focus({ preventScroll: true })

    // Focus alone would leave a row below the fold invisible, so bring it into the list
    nextItem?.scrollIntoView({ block: 'nearest' })
  }

  // The list element to bind, and the two handlers that drive focus around it
  return { listRef, focusFirstItem, onListKeyDown }
}
