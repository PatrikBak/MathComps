import React, { useMemo } from 'react'

import type { MultiSelectFacetOption } from '../components/facets/MultiSelectFacet'
import type { TreeSelectFacetOption } from '../components/facets/TreeSelectFacet'
import type { FacetOption } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import {
  buildSelectionsFromTreeIds,
  categoryNodeId,
  competitionNodeId,
  roundNodeId,
} from '../utils/filter-ids'

/**
 * The type of filter interaction.
 * - 'text': Freeform search (e.g., search bar).
 * - 'discrete': Multi-select facet (e.g., tags, authors, numbers).
 */
type FilterType = 'text' | 'discrete'

/**
 * The available sort modes for facet options.
 * - 'count-desc-alpha': Sort by descending count, then alphabetically.
 * - 'numeric-asc': Sort numerically ascending (for problem numbers, etc.).
 */
type FacetSortMode = 'count-desc-alpha' | 'numeric-asc'

/**
 * Transforms a list of base facet options into UI-ready options with up-to-date counts and resorts-them.
 *
 * @param {FacetOption[]} baseOptions - The full set of available facet options.
 * @param {FacetOption[]} filterOptions - The current set of facet options with counts (from filtered results).
 * @param {FacetSortMode} sortMode - The requested sort mode for the facet options.
 * @returns {MultiSelectFacetOption[]} The transformed and sorted facet options for the UI.
 */
function buildFacetOptions(
  baseOptions: FacetOption[],
  filterOptions: FacetOption[],
  sortMode: FacetSortMode
): MultiSelectFacetOption[] {
  // Build a fast lookup for counts from the currently available options
  const countBySlug = new Map(filterOptions.map((option) => [option.slug, option.count]))

  return (
    baseOptions
      .map((option) => ({
        id: option.slug,
        displayName: option.displayName,
        fullName: option.fullName,
        count: countBySlug.get(option.slug) ?? 0,
      }))
      // Apply the requested sort mode
      .sort((first, second) => {
        switch (sortMode) {
          // Sort by count
          case 'count-desc-alpha':
            // Then alphabetically
            if (second.count !== first.count) {
              return second.count - first.count
            }
            // Then by displayName
            return first.displayName.localeCompare(second.displayName)

          // Sort numerically ascending by number (ignore counts)
          case 'numeric-asc':
            return parseInt(first.displayName, 10) - parseInt(second.displayName, 10)
        }
      })
  )
}

export type UseSearchFiltersLogicProps = {
  filters: SearchFiltersState
  onFiltersChange: (newFilters: SearchFiltersState, filterType: FilterType) => void
  filterOptions: FilterOptionsWithCounts
  baseOptions: FilterOptionsWithCounts
}

/**
 * Encapsulates the complex logic for the search filters sidebar.
 * This hook is responsible for:
 * - Managing the local UI state of the competition selection tree.
 * - Transforming filter data into options suitable for facet components.
 * - Handling filter changes and communicating them to the parent component.
 * - Calculating disabled states for various filter controls.
 *
 * @param props - The props required for the hook to function.
 * @returns An object containing memoized options, handlers, and state for the UI.
 */
export const useSearchFiltersLogic = ({
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
}: UseSearchFiltersLogicProps) => {
  // The competition filter is a tree, allowing users to select entire competitions,
  // categories, or specific rounds. The state can be complex to manage because the user's
  // selection (e.g., 'all of competition X') needs to be mapped to a set of specific IDs
  // for the tree UI component, and vice-versa.

  // Convert the high-level `contestSelection` from the global filter state
  // into a flat list of string IDs that the tree component can understand.
  const selectionTreeNodeIds = useMemo(() => {
    // This logic handles the initial state derived from the URL or parent component.
    if (!filters.contestSelection || !Array.isArray(filters.contestSelection)) {
      return []
    }

    // Map each abstract selection (e.g., { type: 'competition', competitionSlug: 'imo' })
    // to a concrete node ID (e.g., 'competition-imo').
    return filters.contestSelection
      .map((selection) => {
        switch (selection.type) {
          case 'competition':
            return competitionNodeId(selection.competitionSlug)

          case 'category': {
            const competition = baseOptions.competitions.find(
              (competition) => competition.competitionData.slug === selection.competitionSlug
            )
            const categorySlug = selection.categorySlug!
            if (competition) {
              // A category within a competition.
              const hasCategory = competition.categoryData?.some(
                (category) => category.categoryData.slug === categorySlug
              )
              if (hasCategory) {
                return categoryNodeId(selection.competitionSlug, categorySlug)
              }
              //ESome competitions have rounds directly, without categories.
              const hasDirectRound = competition.roundData?.some(
                (round) => round.slug === categorySlug
              )
              if (hasDirectRound) {
                return roundNodeId(selection.competitionSlug, categorySlug)
              }
            }
            // If the selection is invalid (e.g., stale from a previous state), log and ignore it.
            console.warn(
              `Invalid category selection: competition "${selection.competitionSlug}" not found or category "${categorySlug}" not found in competition data. This may indicate stale state.`
            )
            return ''
          }
          case 'round': {
            // Validate that the competition exists before creating the node ID
            const competition = baseOptions.competitions.find(
              (competition) => competition.competitionData.slug === selection.competitionSlug
            )
            if (!competition) {
              console.warn(
                `Invalid round selection: competition "${selection.competitionSlug}" not found. This may indicate stale state.`
              )
              return ''
            }
            return roundNodeId(
              selection.competitionSlug,
              selection.roundSlug!,
              selection.categorySlug
            )
          }
          default:
            console.warn(
              `Unknown contest selection type: "${(selection as { type: string }).type}". This may indicate corrupted state.`
            )
            return ''
        }
      })
      .filter((id) => id !== '')
  }, [filters.contestSelection, baseOptions.competitions])

  // Manage the local UI state for exactly which tree nodes are selected.
  // This state can be updated by the user interacting with the tree, or by changes
  // coming from the parent (e.g., URL change).
  const [selectedTreeIds, setSelectedTreeIds] = React.useState<string[]>(selectionTreeNodeIds)

  // Sync local state when the source of truth from filters changes.
  React.useEffect(() => {
    setSelectedTreeIds(selectionTreeNodeIds)
  }, [selectionTreeNodeIds])

  // Define the handler for when the user changes the tree selection.
  function handleCompetitionTreeChange(nextSelectedIds: string[]) {
    // Update local UI state immediately for responsive checkboxes.
    setSelectedTreeIds(nextSelectedIds)

    // Convert the flat list of IDs back into the structured `ContestSelection` format.
    const { selections } = buildSelectionsFromTreeIds(nextSelectedIds, baseOptions)

    // Propagate the change to the parent component.
    onFiltersChange(
      {
        ...filters,
        contestSelection: selections,
      },
      'discrete'
    )
  }

  // --- Memoized Options for Facets ---

  // The filter options displayed to the user need to be computed by combining two
  // sources of data:
  // 1. `baseOptions`: The complete set of all possible filter values (e.g., all competitions, all tags).
  //    This is used to render the full list of options.
  // 2. `filterOptions`: The set of currently available filter values given the *other* active filters.
  //    This is used to display counts next to each option (e.g., "Algebra (15)") and to disable
  //    options that would yield zero results.

  // The competition tree options are the most complex to build.
  const competitionTreeOpts: TreeSelectFacetOption[] = useMemo(() => {
    // Build a map from competition slug to competition data for quick lookup.
    const competitionDataBySlug = new Map(
      filterOptions.competitions.map((competition) => [
        competition.competitionData.slug,
        competition,
      ])
    )

    // The competitions never disappear from the tree (by design),
    // that is why we're convering base options
    return baseOptions.competitions.map((baseCompetition) => {
      // Lookup the current competition data in the filtered options
      const competitionSlug = baseCompetition.competitionData.slug
      const currentCompetition = competitionDataBySlug.get(competitionSlug)

      // Handle the categories of this competition
      const categoryChildren = baseCompetition.categoryData.map((baseCategory) => {
        // Lookp the category data in the filtered options
        const categorySlug = baseCategory.categoryData.slug
        const currentCategory = currentCompetition?.categoryData.find(
          (category) => category.categoryData.slug === categorySlug
        )

        // Handle round children
        const roundChildren = baseCategory.roundData.map((baseRound) => {
          // Lookup the round in the filtered results
          const currentRound = currentCategory?.roundData.find(
            (round) => round.slug === baseRound.slug
          )

          // Create the node with updated count
          return {
            id: roundNodeId(competitionSlug, baseRound.slug, categorySlug),
            displayName: baseRound.displayName,
            fullName: baseRound.fullName,
            count: currentRound?.count ?? 0,
          }
        })

        // Create the node with updated count
        return {
          id: categoryNodeId(competitionSlug, categorySlug),
          displayName: baseCategory.categoryData.displayName,
          fullName: baseCategory.categoryData.fullName,
          count: currentCategory?.categoryData.count ?? 0,
          children: roundChildren.length > 0 ? roundChildren : undefined,
        }
      })

      // Handle the direct rounds of the competiton
      const directRoundChildren = baseCompetition.roundData.map((baseRound) => {
        // Lookup the round in the filetered data
        const currentRound = currentCompetition?.roundData.find(
          (round) => round.slug === baseRound.slug
        )

        // Create the node with updated count
        return {
          id: roundNodeId(competitionSlug, baseRound.slug),
          displayName: baseRound.displayName,
          fullName: baseRound.fullName,
          count: currentRound?.count ?? 0,
        }
      })

      // Gather the children
      const children = [...categoryChildren, ...directRoundChildren]

      // Create the node with updated count
      return {
        id: competitionNodeId(competitionSlug),
        displayName: baseCompetition.competitionData.displayName,
        fullName: baseCompetition.competitionData.fullName,
        count: currentCompetition?.competitionData.count ?? 0,
        children: children.length > 0 ? children : undefined,
      }
    })
  }, [baseOptions.competitions, filterOptions])

  // Expand all nodes by default
  const defaultExpandedIds = baseOptions.competitions.flatMap((competition) => [
    // Expand competitions
    competitionNodeId(competition.competitionData.slug),
    // Expand each category within competitions
    ...competition.categoryData.map((category) =>
      categoryNodeId(competition.competitionData.slug, category.categoryData.slug)
    ),
    // Rounds have no children (just like me)
  ])

  // For seasons, we will just update counts
  const seasonOpts: MultiSelectFacetOption[] = useMemo(() => {
    // Map season slugs onto current counts
    const slugToCount = new Map(filterOptions.seasons.map((season) => [season.slug, season.count]))

    // Return the options with updated counts
    return baseOptions.seasons.map((season) => ({
      id: season.slug,
      displayName: season.displayName,
      fullName: season.fullName,
      count: slugToCount.get(season.slug) ?? 0,
    }))
  }, [baseOptions.seasons, filterOptions.seasons])

  // Update tag counts and resort
  const tagOpts: MultiSelectFacetOption[] = useMemo(() => {
    return buildFacetOptions(baseOptions.tags, filterOptions.tags, 'count-desc-alpha')
  }, [baseOptions.tags, filterOptions.tags])

  // Update author count and resort
  const authorOpts: MultiSelectFacetOption[] = useMemo(() => {
    return buildFacetOptions(baseOptions.authors, filterOptions.authors, 'count-desc-alpha')
  }, [baseOptions.authors, filterOptions.authors])

  // Update counts (no resort is needed)
  const numberOpts: MultiSelectFacetOption[] = useMemo(() => {
    return buildFacetOptions(
      baseOptions.problemNumbers,
      filterOptions.problemNumbers,
      'numeric-asc'
    )
  }, [baseOptions.problemNumbers, filterOptions.problemNumbers])

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
