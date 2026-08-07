import { usePrevious } from '@mantine/hooks'
import { useEffect, useMemo, useRef, useState } from 'react'

import { groupOptionsByKey } from '../model/facet-logic'
import type { FacetGrouping, FacetOption, FacetSortMode } from '../model/facet-types'

/** The sort modes a section cycles through, in order. */
const SORT_MODE_CYCLE: FacetSortMode[] = ['alpha', 'count-desc', 'count-asc']

/**
 * Per-section sort and collapse state for a grouped facet.
 */
export type UseFacetGroupsResult = {
  /** The ordering each section is under, keyed by section. */
  sortModes: Record<string, FacetSortMode>
  /** Which sections are rolled up, keyed by section. */
  collapsed: Record<string, boolean>
  /** Rolls a section up, or unrolls it. */
  toggleCollapsed: (groupKey: string) => void
  /** Advances a section to the next ordering in the cycle. */
  cycleSortMode: (groupKey: string) => void
}

/**
 * Owns how a grouped facet's sections are ordered and which of them are rolled up.
 *
 * Searching takes the collapse state over for its duration: sections holding a match are
 * forced open so no result can hide behind a closed header, and whatever the user had
 * rolled up is put back once the search box is emptied.
 *
 * @param grouping - The sections to maintain state for, or undefined when the facet is flat.
 * @param query - The current search term, which drives the forced expansion.
 * @param filteredOptions - The options surviving that term, which decide which sections still have results.
 * @returns The state and handlers described by {@link UseFacetGroupsResult}.
 */
export function useFacetGroups(
  grouping: FacetGrouping | undefined,
  query: string,
  filteredOptions: FacetOption[]
): UseFacetGroupsResult {
  // Every section starts under the first ordering of the cycle
  const [sortModes, setSortModes] = useState<Record<string, FacetSortMode>>(() =>
    Object.fromEntries((grouping?.keys ?? []).map((key) => [key, SORT_MODE_CYCLE[0]]))
  )

  // Every section starts unrolled
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((grouping?.keys ?? []).map((key) => [key, false]))
  )

  // What the user had rolled up before searching began, held until the search ends
  const preSearchCollapsedRef = useRef<Record<string, boolean> | null>(null)

  // The live collapse state, readable without the effect below taking a dependency on it
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  // The term as of the previous render, which is what makes a start or end of searching visible
  const previousQuery = usePrevious(query)

  // Hand the collapse state to the search while one is running, and give it back afterwards
  useEffect(() => {
    // A flat facet has no sections whose state could need maintaining
    if (!grouping) return

    // The two edges of a search, read off the term before and after this render
    const wasSearching = (previousQuery ?? '').length > 0
    const isSearching = query.length > 0

    // Searching has just begun, so take down what has to be restored afterwards
    if (!wasSearching && isSearching) {
      preSearchCollapsedRef.current = { ...collapsedRef.current }
    }

    // Searching has just ended, so hand the user back the sections they had rolled up
    if (wasSearching && !isSearching) {
      // Nothing was taken down if the facet opened straight into a search
      if (preSearchCollapsedRef.current !== null) {
        // Put the sections back the way the user had them
        setCollapsed(preSearchCollapsedRef.current)

        // The stash is spent once it has been handed back
        preSearchCollapsedRef.current = null
      }

      // Nothing else to do while the search is unwinding
      return
    }

    // Still searching, so open every section holding a match and roll up the ones left empty
    if (isSearching) {
      // Which section each surviving option belongs to
      const groups = groupOptionsByKey(filteredOptions, grouping.keys)

      // An empty section rolls up, and any section with a hit is forced open
      setCollapsed((current) => ({
        ...current,
        ...Object.fromEntries(grouping.keys.map((key) => [key, groups[key].length === 0])),
      }))
    }
  }, [query, previousQuery, filteredOptions, grouping])

  /**
   * Flips one section between rolled up and unrolled.
   *
   * @param groupKey - The section to flip.
   */
  function toggleCollapsed(groupKey: string) {
    // Only the named section moves; the others keep whatever they were under
    setCollapsed((current) => ({ ...current, [groupKey]: !current[groupKey] }))
  }

  /**
   * Advances one section to the next ordering, wrapping at the end of the cycle.
   *
   * @param groupKey - The section to advance.
   */
  function cycleSortMode(groupKey: string) {
    // Advance just this section's ordering
    setSortModes((current) => {
      // An unknown section is treated as sitting at the start of the cycle
      const currentIndex = SORT_MODE_CYCLE.indexOf(current[groupKey] ?? SORT_MODE_CYCLE[0])

      // The next ordering along, wrapping back to the first at the end
      const nextMode = SORT_MODE_CYCLE[(currentIndex + 1) % SORT_MODE_CYCLE.length]

      // Only the named section moves; the others keep whatever they were under
      return { ...current, [groupKey]: nextMode }
    })
  }

  // An ordering for every current section, including any that arrived after mount
  const resolvedSortModes = useMemo(
    () =>
      Object.fromEntries(
        (grouping?.keys ?? []).map((key) => [key, sortModes[key] ?? SORT_MODE_CYCLE[0]])
      ),
    [grouping, sortModes]
  )

  // The per-section state, plus the two handlers a section header needs
  return { sortModes: resolvedSortModes, collapsed, toggleCollapsed, cycleSortMode }
}
