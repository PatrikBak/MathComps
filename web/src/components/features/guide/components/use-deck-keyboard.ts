import { useHotkeys } from '@mantine/hooks'

/**
 * Wiring for the deck's keyboard shortcuts.
 */
export type DeckKeyboardConfig = {
  /** The active page index. */
  selectedIndex: number
  /** Steps the deck to a page index. */
  goToIndex: (index: number) => void
  /** Whether any card modal is open. */
  anyModalOpen: boolean
  /** Opens the search palette. */
  openPalette: () => void
}

/**
 * Binds the deck's keyboard shortcuts: ◀/▶ page the deck, ⌘K/Ctrl+K and "/" open search. Arrow paging
 * and "/" stand down while a card modal is open; all of them ignore keystrokes typed into a field
 * (mantine skips INPUT/TEXTAREA/SELECT + contentEditable targets). One subscription whose handlers read
 * the latest config on each keypress.
 */
export function useDeckKeyboard({
  selectedIndex,
  goToIndex,
  anyModalOpen,
  openPalette,
}: DeckKeyboardConfig): void {
  // Step the deck by one page on an arrow key, unless a modal is up
  const pageBy = (step: number, event: KeyboardEvent) => {
    // Don't page behind an open card modal
    if (anyModalOpen) return
    // Claim the key so Safari's arrow-driven smooth-scroll animator never fights our scroll-to-top tween
    event.preventDefault()
    // Move to the adjacent page
    goToIndex(selectedIndex + step)
  }

  // One keyboard map for paging + opening search (each handler reads the latest config per keypress)
  useHotkeys([
    // ◀ to the previous page (preventDefault handled inside, only on the paging path)
    ['ArrowLeft', (event) => pageBy(-1, event), { preventDefault: false }],
    // ▶ to the next page
    ['ArrowRight', (event) => pageBy(1, event), { preventDefault: false }],
    // ⌘K / Ctrl+K always opens search
    ['mod+K', () => openPalette()],
    // "/" opens search too, but waits for any open card modal to clear
    ['/', () => !anyModalOpen && openPalette()],
  ])
}
