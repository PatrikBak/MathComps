import { useLocale } from 'next-intl'
import { useMemo } from 'react'

import { useFirstSeenOrder } from '@/hooks/use-first-seen-order'
import { useKeyedState } from '@/hooks/use-keyed-state'

import {
  drawnSectionRowIds,
  facetTabStopRowId,
  orderOptionsForDisplay,
  sectionRowsStandingForSelection,
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
  /** The options surviving the search term, in their incoming order. */
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
  /** The row focus last landed on while it stays among the rows, or null for none. */
  lastFocusedRowId: string | null
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
 * Where the facet floats them, the options standing as the popover opens lead their section. While it stays open
 * every row keeps the place it opened in, an option picked since and a count a pick changes alike, so a run of quick
 * picks lands where it was aimed. A new ordering on any section lays the whole list out afresh.
 *
 * @param options - What the rows are laid out from.
 * @returns The rows described by {@link UseFacetOptionRowsResult}.
 */
export function useFacetOptionRows({
  isOpen,
  filteredOptions,
  grouping,
  sortModes,
  collapsed,
  selected,
  floatsSelectedFirst,
  lastFocusedRowId,
}: UseFacetOptionRowsOptions): UseFacetOptionRowsResult {
  // The active locale
  const locale = useLocale()

  // The options standing as the popover last opened, held while it stays open
  const [standingAtOpen] = useKeyedState(isOpen, selected)

  // The options in the order they would render, worked out afresh
  const orderedOptions = useMemo(() => {
    // Which options float to the top: those standing as the popover opened, so a pick made since stays in the
    // incoming order
    const leadingIds = floatsSelectedFirst ? standingAtOpen : []

    // The options in display order
    return orderOptionsForDisplay({
      options: filteredOptions,
      isOpen,
      grouping,
      sortModes,
      leadingIds,
      locale,
    })
  }, [filteredOptions, isOpen, grouping, sortModes, floatsSelectedFirst, standingAtOpen, locale])

  // The options in the order they render: held where they stood as the popover opened, so a pick changing the counts
  // moves nothing under the pointer, and taken afresh as it opens or a section is given a new ordering
  const displayOptions = useFirstSeenOrder({
    items: orderedOptions,
    keyOf: (option) => option.id,
    resetKey: `${isOpen}|${Object.values(sortModes).join()}`,
    newcomerPlace: 'inPlace',
  })

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

    // The rows standing for the selection, a rolled-up section's heading among them for the options it hides
    const standingRowIds = grouping
      ? sectionRowsStandingForSelection(visibleSections, collapsed, selected)
      : selected

    // The tab stop among them
    return facetTabStopRowId(drawnRowIds, standingRowIds, lastFocusedRowId)
  }, [collapsed, displayOptions, grouping, lastFocusedRowId, selected, visibleSections])

  // The rows in their order, the sections holding them, and the one the tab order reaches
  return { displayOptions, visibleSections, tabStopRowId }
}
