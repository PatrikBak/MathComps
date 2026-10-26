import { useMemo, useState } from 'react'

import { useKeyedState } from '@/hooks/use-keyed-state'

import { applyCollapsibleRowAction, headingKeyOf, sectionsWorthSorting } from '../model/facet-logic'
import type {
  FacetGrouping,
  FacetOption,
  FacetRowAction,
  FacetRowActionHandler,
  FacetSortMode,
} from '../model/facet-types'

/** The sort modes a section cycles through, in order. */
const SORT_MODE_CYCLE: FacetSortMode[] = ['alpha', 'count-desc', 'count-asc']

/** No section at all, which is what the user has rolled up under a search just typed. */
const NO_SECTIONS: Record<string, boolean> = {}

/**
 * What a grouped facet's section state is kept for.
 */
export type UseFacetGroupsOptions = {
  /** The sections to maintain state for, or undefined when the facet is flat. */
  grouping: FacetGrouping | undefined
  /** Every option the facet offers, before searching. */
  options: FacetOption[]
  /** The term the facet is narrowed by. */
  searchTerm: string
}

/**
 * Per-section sort and collapse state for a grouped facet, and the keys its headings answer.
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
  /**
   * Whether the section headings offer a control over their ordering, read off every option the facet has
   * rather than the ones a search left standing, so the control doesn't come and go as the user types.
   */
  showSortButtons: boolean
  /**
   * Applies a key's action to a section's heading, rolling it up or out, and advancing its ordering where the
   * headings offer one.
   */
  onRowAction: FacetRowActionHandler
}

/**
 * Owns how a grouped facet's sections are ordered and which of them are rolled up, and answers the keys pressed on
 * their headings.
 *
 * Searching takes the collapse state over for as long as its term stands: every section holding a match starts
 * open, so no result can hide behind a closed header, and rolling one up acts on the list on screen alone, the next
 * term opening every section afresh. Whatever the user had rolled up is theirs again once the search box is emptied.
 *
 * @param options - What the section state is kept for.
 * @returns The state and handlers described by {@link UseFacetGroupsResult}.
 */
export function useFacetGroups({
  grouping,
  options,
  searchTerm,
}: UseFacetGroupsOptions): UseFacetGroupsResult {
  // Every section starts under the first ordering of the cycle
  const [sortModes, setSortModes] = useState<Record<string, FacetSortMode>>(() =>
    Object.fromEntries((grouping?.keys ?? []).map((key) => [key, SORT_MODE_CYCLE[0]]))
  )

  // The sections the user has rolled up, every one starting unrolled
  const [ownCollapsed, setOwnCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((grouping?.keys ?? []).map((key) => [key, false]))
  )

  // The sections the user has rolled up under the search on screen, forgotten once the term changes
  const [searchCollapsed, setSearchCollapsed] = useKeyedState(searchTerm, NO_SECTIONS)

  // What renders rolled up: under a search only what was rolled up under it, since every section a search leaves on
  // show holds a match, and otherwise the user's own
  const collapsed = searchTerm ? searchCollapsed : ownCollapsed

  /**
   * Flips one section between rolled up and unrolled.
   *
   * @param groupKey - The section to flip.
   */
  function toggleCollapsed(groupKey: string) {
    // Under a search the section moves on screen alone, the user's own state waiting for the box to clear
    if (searchTerm) setSearchCollapsed((current) => flipSection(current, groupKey))
    // With no search it is the user's own state that moves
    else setOwnCollapsed((current) => flipSection(current, groupKey))
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

  // Whether the section headings offer a control over their ordering
  const showSortButtons = useMemo(
    () => (grouping ? sectionsWorthSorting(options, grouping) : false),
    [grouping, options]
  )

  /**
   * Applies a key pressed on a section's heading, every other row having nothing of its own to do.
   *
   * @param rowId - The row focus is on.
   * @param action - What the key asked of it.
   * @returns Whether the section acted.
   */
  function onRowAction(rowId: string, action: FacetRowAction) {
    // The section the row heads, absent on an option
    const groupKey = headingKeyOf(rowId)

    // Only a heading has any of this to offer
    if (!groupKey) return false

    // The section rolls up and out, and reorders where the facet offers orderings at all
    return applyCollapsibleRowAction(action, {
      isOpen: !collapsed[groupKey],
      toggleOpen: () => toggleCollapsed(groupKey),
      cycleSort: showSortButtons ? () => cycleSortMode(groupKey) : null,
    })
  }

  // The per-section state, the handlers a section header needs, and the keys its heading answers
  return {
    sortModes: resolvedSortModes,
    collapsed,
    toggleCollapsed,
    cycleSortMode,
    showSortButtons,
    onRowAction,
  }
}

/**
 * Flips one section of a facet's collapse state.
 *
 * @param collapsed - Which sections are rolled up, keyed by section.
 * @param groupKey - The section to flip.
 * @returns The same state, with that section flipped.
 */
function flipSection(
  collapsed: Record<string, boolean>,
  groupKey: string
): Record<string, boolean> {
  // Only the named section moves; the others keep whatever they were under
  return { ...collapsed, [groupKey]: !collapsed[groupKey] }
}
