import { useLocale } from 'next-intl'
import { type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'

import type { Locale } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

import { GUIDE_CONTENT } from '../content/guide-content'
import { useGuideLabels } from '../content/guide-labels'
import { useGuideDeck } from './guide-deck-context'
import {
  buildGuideSearchIndex,
  type GuideSearchEntry,
  type GuideSearchLinkEntry,
  makeGuideFuse,
  searchGuide,
} from './guide-search'

/**
 * Configuration for {@link useGuideSearch}.
 */
export type GuideSearchConfig = {
  /** Whether the palette is open; each opening resets the query + highlight. */
  isOpen: boolean
  /** Closes the palette (a chosen result closes it before acting). */
  onClose: () => void
}

/**
 * The search palette's live state and the controls a view binds to.
 */
export type GuideSearchController = {
  /** The current query text. */
  query: string
  /** Sets the query and resets the highlight to the top. */
  onQueryChange: (value: string) => void
  /** The keyboard-highlighted result index. */
  selected: number
  /** Highlights a result (e.g. on hover). */
  setSelected: (index: number) => void
  /** The current results, best match first. */
  results: GuideSearchEntry[]
  /** Ref for the highlighted row, kept in view as the highlight moves. */
  activeRowRef: RefObject<HTMLDivElement | null>
  /** Arrow keys move the highlight; Enter reveals, ⌘/Ctrl+Enter opens a lone link. */
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  /** Reveals a result's card in the deck (scroll + highlight, opening its modal if it has one). */
  reveal: (entry: GuideSearchEntry) => void
  /** Opens a lone-link result's target directly. */
  openLink: (entry: GuideSearchLinkEntry) => void
}

/**
 * Drives the guide's cross-page search: builds the per-locale fuzzy index, runs the query, tracks the
 * keyboard highlight (resetting on each open and keeping the active row in view), and dispatches a
 * chosen result — revealing its card in the deck, or opening a lone link's target directly.
 *
 * @param config - Whether the palette is open and how to close it.
 *
 * @returns The query/highlight state and the input, hover, reveal, and open controls.
 */
export function useGuideSearch({ isOpen, onClose }: GuideSearchConfig): GuideSearchController {
  // The active locale (drives the localized index)
  const locale = useLocale() as Locale
  // Localized enum labels
  const labels = useGuideLabels()
  // The deck's deep-link control
  const { requestOpenEntity } = useGuideDeck()
  // Router for internal-link results
  const router = useRouter()

  // The current query and the keyboard-highlighted result
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  // The currently-highlighted row, so it can be kept in view as the selection moves
  const activeRowRef = useRef<HTMLDivElement | null>(null)

  // Build the matcher once per locale/label change
  const fuse = useMemo(
    () => makeGuideFuse(buildGuideSearchIndex(locale, labels, GUIDE_CONTENT)),
    [locale, labels]
  )

  // The current results, best match first
  const results = useMemo(() => searchGuide(fuse, query), [fuse, query])

  // Start each opening from a clean slate
  useEffect(() => {
    // Only reset on the open transition
    if (isOpen) {
      // Clear the query
      setQuery('')
      // Send the highlight to the top
      setSelected(0)
    }
  }, [isOpen])

  // Keep the highlighted row in view as the selection moves
  useEffect(() => {
    // Nudge the active row into view
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected, results])

  // Adopt a new query and send the highlight back to the top
  const onQueryChange = (value: string) => {
    // Adopt the new query
    setQuery(value)
    // Reset the highlight to the first result
    setSelected(0)
  }

  // Reveal a result in the deck: scroll to its card + highlight, opening its modal if it has one
  const reveal = (entry: GuideSearchEntry) => {
    // Close the palette first
    onClose()
    // Ask the deck to surface the entity on its page
    requestOpenEntity(entry.page, entry.id)
  }

  // Open a lone-link result's target directly
  const openLink = (entry: GuideSearchLinkEntry) => {
    // Close the palette first
    onClose()
    // External target → new tab, with the opener severed so it can't reach back into this window
    if (entry.isExternal) window.open(entry.href, '_blank', 'noopener,noreferrer')
    // Internal target → navigate in-app through the locale-aware router (keeps the locale prefix)
    else router.push(entry.href)
  }

  // Arrow keys move the highlight; Enter reveals it, ⌘↵ opens a lone link (Esc close is the Modal's)
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Down steps the highlight toward the end
    if (event.key === 'ArrowDown') {
      // Keep the caret from moving within the input
      event.preventDefault()
      // Advance, clamped to the last result
      setSelected((current) => Math.min(current + 1, results.length - 1))
    }
    // Up steps the highlight toward the start
    else if (event.key === 'ArrowUp') {
      // Keep the caret put
      event.preventDefault()
      // Retreat, clamped to the first result
      setSelected((current) => Math.max(current - 1, 0))
    }
    // Enter commits the highlighted result
    else if (event.key === 'Enter') {
      // Don't submit any wrapping form
      event.preventDefault()
      // The highlighted entry, if any
      const entry = results[selected]
      // Nothing highlighted → nothing to do
      if (!entry) return
      // A modifier on a lone link opens it straight away
      if ((event.metaKey || event.ctrlKey) && entry.behavior === 'link') openLink(entry)
      // A bare Enter (or any non-link) reveals the card
      else reveal(entry)
    }
  }

  // Hand back the live state and the controls a view binds to
  return {
    query,
    onQueryChange,
    selected,
    setSelected,
    results,
    activeRowRef,
    onInputKeyDown,
    reveal,
    openLink,
  }
}
