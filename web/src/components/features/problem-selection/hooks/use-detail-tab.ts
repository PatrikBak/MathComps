'use client'

import { useState } from 'react'

import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'

import { type DetailPage, detailQuery, PAGE_PARAMS, tabOf } from '../model/selection-routes'

/**
 * Options for {@link useDetailTab}.
 */
type UseDetailTabOptions<TTab extends string> = {
  /** The page's tabs in the order they read, the first being the one it opens on by default. */
  tabs: readonly [TTab, ...TTab[]]
  /** Gives the page on a tab. */
  pageOn: (tab: TTab) => DetailPage
}

/**
 * What {@link useDetailTab} hands back.
 */
type UseDetailTabResult<TTab extends string> = {
  /** The tab showing. */
  tab: TTab
  /** Shows another tab. */
  showTab: (tab: TTab) => void
}

/**
 * The tab a page shows, opening on the one the address names. The address keeps naming the tab on screen, so a link
 * copied from it opens the same one, every parameter the page does not write left as it stands.
 *
 * @param options - The page's tabs and the page on each.
 * @returns The tab showing and the way to show another.
 */
export function useDetailTab<TTab extends string>({
  tabs,
  pageOn,
}: UseDetailTabOptions<TTab>): UseDetailTabResult<TTab> {
  // The tab the address opened the page on, the first when it names none
  const addressedTab = useInitialUrlState((params) => tabOf(params, tabs))

  // The tab showing, the addressed one at first, and the way to show another
  const [tab, showTab] = useState<TTab>(addressedTab)

  // The page on the tab showing
  const page = pageOn(tab)

  // Keep the address naming the page and its tab
  useAddressSync(detailQuery(page), PAGE_PARAMS[page.kind])

  // The tab showing and the way to show another
  return { tab, showTab }
}
