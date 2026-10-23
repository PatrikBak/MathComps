import { useLocale } from 'next-intl'
import { useMemo } from 'react'

import { useKeyedState } from '@/hooks/use-keyed-state'

import {
  drawnSectionRowIds,
  facetTabStopRowId,
  orderOptionsForDisplay,
  toVisibleSections,
} from '../model/facet-logic'
import type {
  FacetGrouping,
  FacetOption,
  FacetSortMode,
  VisibleSection,
} from '../model/facet-types'

/**
 * What a facet's option rows are laid out from.
 */
export type UseFacetOptionRowsOptions = {
  /** Whether the popover is open. */
  isOpen: boolean
  /** The current search term. */
  query: string
  /** The options surviving that term, in their incoming order. */
  filteredOptions: FacetOption[]
  /** The labelled sections the options are split into, absent on a flat facet. */
  grouping: FacetGrouping | undefined
  /** The ordering each section is under, keyed by section. */
  sortModes: Record<string, FacetSortMode>
  /** Which sections are rolled up, keyed by section. */
  collapsed: Record<string, boolean>
  /** Ids of the options currently selected. */
  selected: string[]
  /** Whether the options standing as the popover opens lead their section until it closes. */
  floatsSelectedFirst: boolean
}

/**
 * The rows a facet's option list draws, and the one of them the page's tab order reaches.
 */
export type UseFacetOptionRowsResult = {
  /** The options in the order they render. */
  displayOptions: FacetOption[]
  /** The sections that currently have something to show, empty for a flat facet. */
  visibleSections: VisibleSection[]
  /** The one row the panel offers the page's tab order, absent while the list draws nothing. */
  tabStopRowId: string | undefined
}

/**
 * Lays out a facet's option rows: the order they render in, the sections they fall into, and the one row the
 * page's tab order reaches.
 *
 * Where the facet floats them, the options standing as the popover opens lead their section. An option picked while
 * it stays open keeps the place the incoming order gives it, so a run of quick picks lands where it was aimed, and a
 * search lists its results in their incoming order. A list ordered by count still re-sorts when a pick changes the
 * counts.
 *
 * @param options - What the rows are laid out from.
 * @returns The rows described by {@link UseFacetOptionRowsResult}.
 */
export function useFacetOptionRows({
  isOpen,
  query,
  filteredOptions,
  grouping,
  sortModes,
  collapsed,
  selected,
  floatsSelectedFirst,
}: UseFacetOptionRowsOptions): UseFacetOptionRowsResult {
  // The active locale
  const locale = useLocale()

  // The options standing as the popover last opened, held while it stays open
  const [standingAtOpen] = useKeyedState(isOpen, selected)

  // The options in the order they should render
  const displayOptions = useMemo(() => {
    // Which options float to the top: those standing as the popover opened, so a pick made since stays in the
    // incoming order
    const leadingIds = floatsSelectedFirst ? standingAtOpen : []

    // The options in display order
    return orderOptionsForDisplay({
      options: filteredOptions,
      isOpen,
      query,
      grouping,
      sortModes,
      leadingIds,
      locale,
    })
  }, [
    filteredOptions,
    isOpen,
    query,
    grouping,
    sortModes,
    floatsSelectedFirst,
    standingAtOpen,
    locale,
  ])

  // The sections that currently have something to show, empty for a flat facet
  const visibleSections = useMemo(
    () => (grouping ? toVisibleSections(displayOptions, grouping) : []),
    [grouping, displayOptions]
  )

  // The one row the panel offers the page's tab order, read off the rows actually drawn, since an option inside
  // a rolled-up section is not there to be focused
  const tabStopRowId = useMemo(() => {
    // The rows on show: under a grouped facet every section's heading and the options of the unrolled ones
    const drawnRowIds = grouping
      ? drawnSectionRowIds(visibleSections, collapsed)
      : displayOptions.map((option) => option.id)

    // The tab stop among them
    return facetTabStopRowId(drawnRowIds, selected)
  }, [collapsed, displayOptions, grouping, selected, visibleSections])

  // The rows in their order, the sections holding them, and the one the tab order reaches
  return { displayOptions, visibleSections, tabStopRowId }
}
