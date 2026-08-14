import { useLocale } from 'next-intl'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import type {
  FacetOption as FacetUiOption,
  TreeNode,
} from '@/components/shared/components/facets/model/facet-types'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { FacetOption } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { foldPickedPaths } from '../utils/competition-selection-fold'
import {
  buildCompetitionTree,
  competitionSelectionFor,
  expandedByDefault,
  toFacetNodes,
} from '../utils/competition-tree'

/**
 * How a facet's options are ordered before they reach the UI.
 */
type OptionSortMode = 'count-desc-alpha' | 'numeric-asc'

/**
 * Restates the options a facet always offers with the counts they carry under the current
 * filters, and puts them in the order the facet wants them.
 *
 * @param baseOptions - Every option the facet offers, whatever is filtered.
 * @param filterOptions - The options surviving the other filters, which is where the counts come from.
 * @param sortMode - The ordering to apply.
 * @param locale - The locale the names are collated under.
 * @returns The options a facet renders, ordered.
 */
function buildFacetOptions(
  baseOptions: FacetOption[],
  filterOptions: FacetOption[],
  sortMode: OptionSortMode,
  locale: string
): FacetUiOption[] {
  // Counts keyed by slug, so restating an option is a lookup
  const countBySlug = new Map(filterOptions.map((option) => [option.slug, option.count]))

  // Every option the facet offers, carrying whatever count it has right now
  const options = baseOptions.map((option) => ({
    id: option.slug,
    displayName: option.displayName,
    count: countBySlug.get(option.slug) ?? 0,
    groupKey: option.tagType,
  }))

  // Ordered under the requested mode
  return options.sort((first, second) => {
    switch (sortMode) {
      // The biggest count leads, with the name settling a tie
      case 'count-desc-alpha':
        // Differing counts decide it on their own
        if (second.count !== first.count) {
          // The bigger count comes first
          return second.count - first.count
        }

        // Equal counts carry no ordering, so defer to the name, collated as the reader's language does
        return first.displayName.localeCompare(second.displayName, locale)

      // Names that are numbers, ordered as numbers and not as text
      case 'numeric-asc':
        return parseInt(first.displayName, 10) - parseInt(second.displayName, 10)

      // A mode outside the union, which the type system rules out
      default:
        return assertNever(sortMode)
    }
  })
}

/**
 * Props for the {@link useSearchFiltersLogic} hook.
 */
export type UseSearchFiltersLogicProps = {
  /** The filters currently applied. */
  filters: SearchFiltersState
  /** Applies a change the user made to a filter. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
  /** Option counts under the filters currently applied. */
  filterOptions: FilterOptionsWithCounts
  /** Every option the library can ever offer, whatever is filtered. */
  baseOptions: FilterOptionsWithCounts
}

/**
 * The facet options carrying their current counts, the competition tree's expanded and selected
 * nodes, and the handler that records a selection made in the tree.
 */
export type UseSearchFiltersLogicResult = {
  /** The competition hierarchy, its counts brought up to date. */
  competitionTreeOpts: TreeNode[]
  /** The nodes the competition tree starts open on. */
  defaultExpandedIds: string[]
  /** Which tree nodes are selected in their own right. */
  selectedTreeIds: string[]
  /** Applies a selection the user made in the tree. */
  handleCompetitionTreeChange: (nextSelectedIds: string[]) => void
  /** The season options, their counts brought up to date. */
  seasonOpts: FacetUiOption[]
  /** The tag options, ordered by how many results carry them. */
  tagOpts: FacetUiOption[]
  /** The author options, ordered by how many results carry them. */
  authorOpts: FacetUiOption[]
  /** The problem-number options, ordered numerically. */
  numberOpts: FacetUiOption[]
}

/**
 * Turns the filter state and the option counts into what the sidebar's facets render,
 * and turns a facet's selection back into filter state.
 *
 * The competition facet is the awkward one: the tree hands back every node ticked in its own
 * right, while the filters hold the shallowest nodes covering exactly those, so a click has to
 * be folded up before it is recorded.
 *
 * @param props - The filter state and option counts, per {@link UseSearchFiltersLogicProps}.
 * @returns The options, state and handlers described by {@link UseSearchFiltersLogicResult}.
 */
export function useSearchFiltersLogic({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
}: UseSearchFiltersLogicProps): UseSearchFiltersLogicResult {
  // The reader's locale, which decides how the facet names collate against each other
  const locale = useLocale()

  // The taxonomy as the filters address it. It turns only on which nodes exist, so it stays put while
  // the counts move and a count arriving never disturbs a selection the user just made.
  const competitionTree = useMemo(
    () => buildCompetitionTree(baseOptions.competitions, baseOptions.competitions),
    [baseOptions.competitions]
  )

  // The filters' competition selection, addressed the way the tree addresses its nodes
  const selectionTreeNodeIds = useMemo(() => {
    // No list of selections, nothing to address
    if (!filters.competitionSelection || !Array.isArray(filters.competitionSelection)) {
      // Nothing for the tree to tick
      return []
    }

    // A selection naming a node the taxonomy no longer holds drops out
    return filters.competitionSelection
      .map((selection) => selection.path)
      .filter((path) => competitionTree.byPath.has(path))
  }, [filters.competitionSelection, competitionTree])

  // The tree's own selection, held locally so a click lands on the checkbox at once
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>(selectionTreeNodeIds)

  // The filters lead, so a selection made anywhere else takes the local copy over
  useEffect(() => {
    setSelectedTreeIds(selectionTreeNodeIds)
  }, [selectionTreeNodeIds])

  /**
   * Records a selection the user made in the competition tree.
   *
   * @param nextSelectedIds - The nodes selected in their own right after the click.
   */
  function handleCompetitionTreeChange(nextSelectedIds: string[]) {
    // Show it immediately, ahead of the round trip through the filters
    setSelectedTreeIds(nextSelectedIds)

    // The same selection expressed at whatever depth covers it
    const selections = foldPickedPaths(nextSelectedIds, competitionTree).map(
      competitionSelectionFor
    )

    // Only the competition filter moves; everything else stays as it was
    onFiltersChange({
      ...filters,
      competitionSelection: selections,
    })
  }

  // Building the tree is the expensive part of a filter change, so let it lag the counts
  const deferredFilterOptions = useDeferredValue(filterOptions)

  // The whole hierarchy, since a competition never disappears from the tree, only its count changes
  const competitionTreeOpts: TreeNode[] = useMemo(() => {
    // The same nodes as the tree above, carrying the counts the current filters leave them
    const countedTree = buildCompetitionTree(
      baseOptions.competitions,
      deferredFilterOptions.competitions
    )

    // Handed over in the shape the shared facet renders
    return toFacetNodes(countedTree.roots)
  }, [baseOptions.competitions, deferredFilterOptions])

  // Every branch starts open, so the whole hierarchy is visible without any clicking
  const defaultExpandedIds = useMemo(() => expandedByDefault(competitionTree), [competitionTree])

  // The seasons, which are already in the order they should render
  const seasonOpts: FacetUiOption[] = useMemo(() => {
    // Counts keyed by season slug, so restating a season is a lookup
    const countBySlug = new Map(filterOptions.seasons.map((season) => [season.slug, season.count]))

    // Every season the library holds, carrying whatever count it has right now
    return baseOptions.seasons.map((season) => ({
      id: season.slug,
      displayName: season.displayName,
      count: countBySlug.get(season.slug) ?? 0,
    }))
  }, [baseOptions.seasons, filterOptions.seasons])

  // The tags, with the ones carrying the most results leading
  const tagOpts: FacetUiOption[] = useMemo(
    () => buildFacetOptions(baseOptions.tags, filterOptions.tags, 'count-desc-alpha', locale),
    [baseOptions.tags, filterOptions.tags, locale]
  )

  // The authors, with the most prolific leading
  const authorOpts: FacetUiOption[] = useMemo(
    () => buildFacetOptions(baseOptions.authors, filterOptions.authors, 'count-desc-alpha', locale),
    [baseOptions.authors, filterOptions.authors, locale]
  )

  // The problem numbers, which read as a sequence and so stay in numeric order
  const numberOpts: FacetUiOption[] = useMemo(
    () =>
      buildFacetOptions(
        baseOptions.problemNumbers,
        filterOptions.problemNumbers,
        'numeric-asc',
        locale
      ),
    [baseOptions.problemNumbers, filterOptions.problemNumbers, locale]
  )

  // Everything the sidebar renders from, plus the one handler it writes back through
  return {
    competitionTreeOpts,
    defaultExpandedIds,
    selectedTreeIds,
    handleCompetitionTreeChange,
    seasonOpts,
    tagOpts,
    authorOpts,
    numberOpts,
  }
}
