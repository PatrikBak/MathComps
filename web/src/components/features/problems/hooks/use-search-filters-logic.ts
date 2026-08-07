import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import type {
  FacetOption as FacetUiOption,
  TreeNode,
} from '@/components/shared/components/facets/model/facet-types'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { FacetOption } from '../types/problem-api-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import {
  buildSelectionsFromTreeIds,
  categoryNodeId,
  competitionNodeId,
  roundNodeId,
} from '../utils/filter-ids'

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
 * @returns The options a facet renders, ordered.
 */
function buildFacetOptions(
  baseOptions: FacetOption[],
  filterOptions: FacetOption[],
  sortMode: OptionSortMode
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
          return second.count - first.count
        }

        // Equal counts carry no ordering, so defer to the name
        return first.displayName.localeCompare(second.displayName)

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
 * Everything the filter sidebar renders from.
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
 * The competition facet is the awkward one: the filters record a selection at whatever
 * level the user picked, while the tree addresses everything by node id, so the two
 * representations have to be mapped onto each other in both directions.
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
  // The filters' contest selection, addressed the way the tree addresses its nodes
  const selectionTreeNodeIds = useMemo(() => {
    // A selection can arrive from the URL, where it may be absent or malformed
    if (!filters.contestSelection || !Array.isArray(filters.contestSelection)) {
      return []
    }

    // Each selection names one node, and anything unresolvable drops out below
    return (
      filters.contestSelection
        .map((selection) => {
          switch (selection.type) {
            // A whole competition is addressed by its slug alone
            case 'competition':
              return competitionNodeId(selection.competitionSlug)

            // A category is addressed by its competition and itself, once both are found to exist
            case 'category': {
              // The competition the selection sits under
              const competition = baseOptions.competitions.find(
                (competition) => competition.competitionData.slug === selection.competitionSlug
              )

              // The category the selection names
              const categorySlug = selection.categorySlug

              // Without the competition there is nothing to resolve the category against
              if (competition) {
                // The straightforward case: the competition really has that category
                const hasCategory = competition.categoryData?.some(
                  (category) => category.categoryData.slug === categorySlug
                )

                // Addressed at the category level, the way it was picked
                if (hasCategory) {
                  return categoryNodeId(selection.competitionSlug, categorySlug)
                }

                // Competitions without a category level hang their rounds where a category would be
                const hasDirectRound = competition.roundData?.some(
                  (round) => round.slug === categorySlug
                )

                // Addressed as a round instead, since that is what the slug turned out to name
                if (hasDirectRound) {
                  return roundNodeId(selection.competitionSlug, categorySlug)
                }
              }

              // The taxonomy has moved on since the selection was made
              console.warn(
                `Invalid category selection: competition "${selection.competitionSlug}" not found or category "${categorySlug}" not found in competition data. This may indicate stale state.`
              )

              // An empty id, which is filtered out below
              return ''
            }

            // A round names its own category, so only the competition has to be checked
            case 'round': {
              // The competition the round sits under
              const competition = baseOptions.competitions.find(
                (competition) => competition.competitionData.slug === selection.competitionSlug
              )

              // The taxonomy has moved on since the selection was made
              if (!competition) {
                console.warn(
                  `Invalid round selection: competition "${selection.competitionSlug}" not found. This may indicate stale state.`
                )

                // An empty id, which is filtered out below
                return ''
              }

              // A round is addressed by its competition, its category when it has one, and itself
              return roundNodeId(
                selection.competitionSlug,
                selection.roundSlug,
                selection.categorySlug
              )
            }

            // A level the app does not know, which only a corrupted URL can produce
            default:
              console.warn(
                `Unknown contest selection type: "${(selection as { type: string }).type}". This may indicate corrupted state.`
              )

              // An empty id, which is filtered out below
              return ''
          }
        })
        // The empty ids stood for selections nothing in the hierarchy answers to
        .filter((id) => id !== '')
    )
  }, [filters.contestSelection, baseOptions.competitions])

  // The tree's own selection, held locally so a click lands on the checkbox at once
  const [selectedTreeIds, setSelectedTreeIds] = useState<string[]>(selectionTreeNodeIds)

  // A selection arriving from anywhere else, such as the URL, overrides the local copy
  useEffect(() => {
    // The filters are the source of truth, so the tree follows them rather than the reverse
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

    // The same selection expressed at whatever level covers it
    const selections = buildSelectionsFromTreeIds(nextSelectedIds, baseOptions)

    // Only the competition filter moves; everything else stays as it was
    onFiltersChange({
      ...filters,
      contestSelection: selections,
    })
  }

  // Building the tree is the expensive part of a filter change, so let it lag the counts
  const deferredFilterOptions = useDeferredValue(filterOptions)

  // The whole hierarchy, since a competition never disappears from the tree, only its count changes
  const competitionTreeOpts: TreeNode[] = useMemo(() => {
    // Counts keyed by competition slug, so restating a competition is a lookup
    const competitionDataBySlug = new Map(
      deferredFilterOptions.competitions.map((competition) => [
        competition.competitionData.slug,
        competition,
      ])
    )

    // One root per competition, each carrying whatever hangs off it
    return baseOptions.competitions.map((baseCompetition) => {
      // The competition's own slug
      const competitionSlug = baseCompetition.competitionData.slug

      // What this competition looks like under the current filters
      const currentCompetition = competitionDataBySlug.get(competitionSlug)

      // The category level, where the competition has one
      const categoryChildren = baseCompetition.categoryData.map((baseCategory) => {
        // The category's own slug
        const categorySlug = baseCategory.categoryData.slug

        // What this category looks like under the current filters
        const currentCategory = currentCompetition?.categoryData.find(
          (category) => category.categoryData.slug === categorySlug
        )

        // The rounds sitting under the category
        const roundChildren = baseCategory.roundData.map((baseRound) => {
          // What this round looks like under the current filters
          const currentRound = currentCategory?.roundData.find(
            (round) => round.slug === baseRound.slug
          )

          // A leaf, since nothing hangs off a round
          return {
            id: roundNodeId(competitionSlug, baseRound.slug, categorySlug),
            displayName: baseRound.displayName,
            fullName: baseRound.fullName,
            count: currentRound?.count ?? 0,
          }
        })

        // A branch, unless the category turns out to hold no rounds
        return {
          id: categoryNodeId(competitionSlug, categorySlug),
          displayName: baseCategory.categoryData.displayName,
          fullName: baseCategory.categoryData.fullName,
          count: currentCategory?.categoryData.count ?? 0,
          children: roundChildren.length > 0 ? roundChildren : undefined,
        }
      })

      // Some competitions have no category level and hang their rounds off the root
      const directRoundChildren = baseCompetition.roundData.map((baseRound) => {
        // What this round looks like under the current filters
        const currentRound = currentCompetition?.roundData.find(
          (round) => round.slug === baseRound.slug
        )

        // A leaf, since nothing hangs off a round
        return {
          id: roundNodeId(competitionSlug, baseRound.slug),
          displayName: baseRound.displayName,
          fullName: baseRound.fullName,
          count: currentRound?.count ?? 0,
        }
      })

      // A competition can carry both levels at once
      const children = [...categoryChildren, ...directRoundChildren]

      // The root, left childless when the competition has nothing under it
      return {
        id: competitionNodeId(competitionSlug),
        displayName: baseCompetition.competitionData.displayName,
        fullName: baseCompetition.competitionData.fullName,
        count: currentCompetition?.competitionData.count ?? 0,
        children: children.length > 0 ? children : undefined,
      }
    })
  }, [baseOptions.competitions, deferredFilterOptions])

  // Every branch starts open, so the whole hierarchy is visible without any clicking
  const defaultExpandedIds = baseOptions.competitions.flatMap((competition) => [
    // The competition itself
    competitionNodeId(competition.competitionData.slug),

    // Every category under it
    ...competition.categoryData.map((category) =>
      categoryNodeId(competition.competitionData.slug, category.categoryData.slug)
    ),

    // Rounds have no children (just like me)
  ])

  // The seasons, which are already in the order they should render
  const seasonOpts: FacetUiOption[] = useMemo(() => {
    // Counts keyed by season slug, so restating a season is a lookup
    const slugToCount = new Map(filterOptions.seasons.map((season) => [season.slug, season.count]))

    // Every season the library holds, carrying whatever count it has right now
    return baseOptions.seasons.map((season) => ({
      id: season.slug,
      displayName: season.displayName,
      count: slugToCount.get(season.slug) ?? 0,
    }))
  }, [baseOptions.seasons, filterOptions.seasons])

  // The tags, with the ones carrying the most results leading
  const tagOpts: FacetUiOption[] = useMemo(
    () => buildFacetOptions(baseOptions.tags, filterOptions.tags, 'count-desc-alpha'),
    [baseOptions.tags, filterOptions.tags]
  )

  // The authors, with the most prolific leading
  const authorOpts: FacetUiOption[] = useMemo(
    () => buildFacetOptions(baseOptions.authors, filterOptions.authors, 'count-desc-alpha'),
    [baseOptions.authors, filterOptions.authors]
  )

  // The problem numbers, which read as a sequence and so stay in numeric order
  const numberOpts: FacetUiOption[] = useMemo(
    () =>
      buildFacetOptions(baseOptions.problemNumbers, filterOptions.problemNumbers, 'numeric-asc'),
    [baseOptions.problemNumbers, filterOptions.problemNumbers]
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
