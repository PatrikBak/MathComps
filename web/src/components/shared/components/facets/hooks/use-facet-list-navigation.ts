import { type KeyboardEvent, type RefObject, useRef } from 'react'

/** How many parts the list is split into, one of which a page key jumps over. */
const PAGE_FRACTION = 10

/** The keys this hook takes over from the browser. */
const NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']

/**
 * The ref and handlers walking keyboard focus through a facet's option list.
 */
export type UseFacetListNavigationResult = {
  /** The scrolling list element, whose checkboxes are what focus moves between. */
  listRef: RefObject<HTMLDivElement | null>
  /** Moves focus to the first option. */
  focusFirstItem: () => void
  /** Handles the arrow, home, end and page keys within the list. */
  onListKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
}

/**
 * Lets the arrow, home, end and page keys walk a facet's options.
 *
 * Focus lands on the real checkboxes rather than on a roving tabindex, which leaves
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
   * @returns The rendered option checkboxes, in document order.
   */
  function optionInputs(): HTMLInputElement[] {
    // The checkboxes standing in for the rows, in document order
    const inputs = listRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')

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
    if (!NAVIGATION_KEYS.includes(event.key)) return

    // The hook moves focus itself, so the browser's own handling of the key is dropped
    event.preventDefault()

    // The rows focus can move between
    const items = optionInputs()

    // An empty list has nowhere to move focus to
    if (items.length === 0) return

    // Focus may sit outside the list, in which case movement starts from the top
    const focusedIndex = items.findIndex((item) => item === document.activeElement)
    const currentIndex = focusedIndex === -1 ? 0 : focusedIndex

    // How far a page key travels, never less than a single row
    const page = Math.max(1, Math.floor(items.length / PAGE_FRACTION))

    // The far end of the list, which the downward keys clamp to
    const lastIndex = items.length - 1

    // Where the pressed key lands, clamped to the ends of the list
    const nextIndex = (() => {
      switch (event.key) {
        // One row down, stopping at the last
        case 'ArrowDown':
          return Math.min(lastIndex, currentIndex + 1)

        // One row up, stopping at the first
        case 'ArrowUp':
          return Math.max(0, currentIndex - 1)

        // Straight to the top of the list
        case 'Home':
          return 0

        // Straight to the bottom of it
        case 'End':
          return lastIndex

        // A page further down, no further than the last row
        case 'PageDown':
          return Math.min(lastIndex, currentIndex + page)

        // A page further up, no further than the first row
        case 'PageUp':
          return Math.max(0, currentIndex - page)

        // Nothing else reaches here, since the guard above filtered the key set
        default:
          return currentIndex
      }
    })()

    // The row the key picked
    const nextItem = items[nextIndex]

    // Scrolling is suppressed here too, since the row is brought into view deliberately below
    nextItem?.focus({ preventScroll: true })

    // Focus alone would leave a row below the fold invisible, so bring it into the list
    nextItem?.scrollIntoView({ block: 'nearest' })
  }

  // The list element to bind, and the two handlers that drive focus around it
  return { listRef, focusFirstItem, onListKeyDown }
}
