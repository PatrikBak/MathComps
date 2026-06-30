import { useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { type Locale } from '@/i18n/i18n'

import { GUIDE_PAGES, type GuidePage } from '../content/guide-content-types'
import { EMPTY_FILTERS, type GuideFilters } from '../content/guide-filters'
import { decodeDeckState, encodeDeckState } from '../content/guide-url'

/**
 * The deck's URL-backed page + per-page filter memory, and the controls that mutate it.
 */
export type DeckUrlState = {
  /** The active page's index, resolved from the URL. */
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
 * Owns the guide deck's source of truth: the active page and every page's filters live in the URL,
 * backed by an in-session memory so switching back to a page restores its filters. Navigation scrolls
 * the deck up to its sticky top, then writes the new view to the URL via the History API, without a
 * server navigation.
 *
 * @param scrollToStickyTop - Glides the deck's top flush beneath the site header (upward only).
 *
 * @returns The active index, a per-page filter lookup, and the navigation + filter controls.
 */
export function useDeckUrlState(scrollToStickyTop: () => void): DeckUrlState {
  // The live URL query (active page + filters live here)
  const searchParams = useSearchParams()
  // The active locale (drives localized URL encoding)
  const locale = useLocale() as Locale

  // Decode the active page + its filters from the URL
  const urlState = useMemo(
    () => decodeDeckState(new URLSearchParams(searchParams.toString()), locale),
    [searchParams, locale]
  )

  // Session memory of every page's filters (so switching back restores them), seeded from the URL
  const [filtersByPage, setFiltersByPage] = useState<Record<GuidePage, GuideFilters>>(() => {
    // Start every page pristine
    const seeded = Object.fromEntries(GUIDE_PAGES.map((page) => [page, EMPTY_FILTERS])) as Record<
      GuidePage,
      GuideFilters
    >
    // Then overlay the filters the URL arrived with onto its page
    seeded[urlState.page] = urlState.filters
    // Hand the seeded map to useState as the initial value
    return seeded
  })

  // Sync the active page's remembered filters from the URL (handles back/forward + deep links)
  useEffect(() => {
    setFiltersByPage((previous) => ({ ...previous, [urlState.page]: urlState.filters }))
  }, [urlState])

  // The active page index
  const selectedIndex = GUIDE_PAGES.indexOf(urlState.page)

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
      // Restore that page's remembered filters
      const page = GUIDE_PAGES[index]
      const filters = filtersByPage[page] ?? EMPTY_FILTERS
      // Push the new view
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
