import { useLocale } from 'next-intl'
import { useCallback, useState } from 'react'

import { type Locale } from '@/i18n/i18n'

import { GUIDE_PAGES, type GuidePage } from '../content/guide-content-types'
import { EMPTY_FILTERS, type GuideDeckState, type GuideFilters } from '../content/guide-filters'
import { encodeDeckState } from '../content/guide-url'

/**
 * The deck's active page + per-page filter memory, and the controls that mutate it.
 */
export type DeckUrlState = {
  /** The active page's index. */
  selectedIndex: number
  /** A page's remembered filters (empty when that page was never touched). */
  filtersForPage: (page: GuidePage) => GuideFilters
  /** Navigate to a page index; out-of-range and same-page calls are no-ops. */
  goToIndex: (index: number) => void
  /** Navigate to a page by name. */
  goToPage: (page: GuidePage) => void
  /** Remember a page's new filters and reflect them in the URL. */
  setPageFilters: (page: GuidePage, filters: GuideFilters) => void
}

/**
 * Owns the guide deck's active page and every page's filters as local state, seeded from the
 * server-decoded initial view, and backed by an in-session memory so switching back to a page
 * restores its filters. Reading the URL server-side (not this hook) is what lets the deck render into
 * crawlable HTML. Navigation scrolls the deck up to its sticky top, moves the active page, then
 * mirrors the new view into the URL via the History API (a write-only reflection, never read back),
 * so shareable/deep-link URLs still work without a server navigation.
 *
 * @param initialState - The view to open the deck on.
 * @param scrollToStickyTop - Glides the deck's top flush beneath the site header (upward only).
 *
 * @returns The active index, a per-page filter lookup, and the navigation + filter controls.
 */
export function useDeckUrlState(
  initialState: GuideDeckState,
  scrollToStickyTop: () => void
): DeckUrlState {
  // The active locale (drives localized URL encoding)
  const locale = useLocale() as Locale

  // The active page index, seeded from the initial view
  const [selectedIndex, setSelectedIndex] = useState(() => GUIDE_PAGES.indexOf(initialState.page))

  // Session memory of every page's filters (so switching back restores them), seeded from the initial view
  const [filtersByPage, setFiltersByPage] = useState<Record<GuidePage, GuideFilters>>(() => {
    // Start every page pristine
    const seeded = Object.fromEntries(GUIDE_PAGES.map((page) => [page, EMPTY_FILTERS])) as Record<
      GuidePage,
      GuideFilters
    >
    // Then overlay the filters the initial view arrived with onto its page
    seeded[initialState.page] = initialState.filters
    // Hand the seeded map to useState as the initial value
    return seeded
  })

  // Write a page + its filters to the URL
  const pushUrl = useCallback(
    (page: GuidePage, filters: GuideFilters) => {
      // Encode to a localized query string (empty when pristine)
      const queryString = encodeDeckState({ page, filters }, locale)
      // Build the target URL, swapping only the query onto the current localized path
      const path = window.location.pathname
      const url = queryString ? `${path}?${queryString}` : path
      // Write it via the History API, not the router, to avoid an RSC refetch on every navigation
      window.history.replaceState(null, '', url)
    },
    [locale]
  )

  // Navigate the deck to a page index — an instant swap, scrolled up to the sticky top
  const goToIndex = useCallback(
    (index: number) => {
      // Ignore out-of-range navigation
      if (index < 0 || index >= GUIDE_PAGES.length) return
      // Already on this page — nothing to do. Covers a drag that snaps back to the same slide, the
      // Pager's resize-driven re-init self-heal (both re-fire onSelect), and re-clicking the active tab.
      if (index === selectedIndex) return
      // Scroll up to the sticky tab bar so the new page starts at the top
      scrollToStickyTop()
      // Move to the page
      setSelectedIndex(index)
      // Restore that page's remembered filters
      const page = GUIDE_PAGES[index]
      const filters = filtersByPage[page] ?? EMPTY_FILTERS
      // Mirror the new view into the URL
      pushUrl(page, filters)
    },
    [pushUrl, scrollToStickyTop, selectedIndex, filtersByPage]
  )

  // Remember a page's new filters and reflect them in the URL
  const setPageFilters = useCallback(
    (page: GuidePage, filters: GuideFilters) => {
      // Remember the new selection
      setFiltersByPage((previous) => ({ ...previous, [page]: filters }))
      // Reflect it in the URL
      pushUrl(page, filters)
    },
    [pushUrl]
  )

  // Jump to a page by name
  const goToPage = useCallback(
    (page: GuidePage) => goToIndex(GUIDE_PAGES.indexOf(page)),
    [goToIndex]
  )

  // A page's filters, from the in-session memory (empty when unset)
  const filtersForPage = useCallback(
    (page: GuidePage): GuideFilters => filtersByPage[page] ?? EMPTY_FILTERS,
    [filtersByPage]
  )

  // Hand back the active index, the per-page filter lookup, and the controls
  return { selectedIndex, filtersForPage, goToIndex, goToPage, setPageFilters }
}
