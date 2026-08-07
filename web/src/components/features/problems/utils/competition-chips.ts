import type * as React from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'

import { isExclusiveSelection } from '../../../shared/utils/event-utils'
import type { ContestSelection } from '../types/problem-library-types'
import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import {
  buildSelectionsFromTreeIds,
  categoryNodeId,
  competitionNodeId,
  DIRECT_ROUND_KEY,
  roundNodeId,
} from './filter-ids'

/**
 * One competition filter as it reads in the active-filter bar.
 */
type CompetitionChip = {
  /** Identifies the chip. */
  id: string
  /** Short text shown on the chip. */
  displayName: string
  /** The unabbreviated name. */
  fullName?: string
  /** Removes the selection, or narrows the filter to it alone under a modifier. */
  onClick: (event: React.MouseEvent) => void
}

/**
 * Identifies a selection among the chips, in a namespace of its own.
 *
 * @param selection - The selection to identify.
 * @returns Its chip id.
 */
function chipId(selection: ContestSelection): string {
  switch (selection.type) {
    // A competition is identified by nothing but itself
    case 'competition':
      return `competition-${selection.competitionSlug}`

    // A category needs its competition too, since category slugs repeat across them
    case 'category':
      return `category-${selection.competitionSlug}-${selection.categorySlug}`

    // A round names the category it sits under, or that it sits under none
    case 'round':
      return `round-${selection.competitionSlug}-${selection.categorySlug || DIRECT_ROUND_KEY}-${selection.roundSlug}`

    // A level outside the union, which the type system rules out
    default:
      return assertNever(selection)
  }
}

/**
 * Builds the chips for the competitions currently filtered on, each folded up to the
 * shallowest level that covers it and ordered as the tree orders them.
 *
 * @param filters - The filters currently applied.
 * @param baseOptions - The whole hierarchy, which supplies both the folding and the order.
 * @param onFiltersChange - Applies the filter state a chip's click produces.
 * @returns The chips to show, in the tree's own order.
 */
export function generateCompetitionChips(
  filters: SearchFiltersState,
  baseOptions: FilterOptionsWithCounts,
  onFiltersChange: (newFilters: SearchFiltersState) => void
): CompetitionChip[] {
  // Filled in once the selections have been folded
  const chips: CompetitionChip[] = []

  // A selection can arrive from the URL, where it may be absent or malformed
  if (
    !filters.contestSelection ||
    !Array.isArray(filters.contestSelection) ||
    filters.contestSelection.length === 0
  ) {
    // Nothing is filtered on, so there is nothing to show
    return chips
  }

  // The folding works on node ids, so the selections are addressed the tree's way first
  const treeIds = filters.contestSelection.map((selection) => {
    switch (selection.type) {
      // A whole competition is addressed by its slug alone
      case 'competition':
        return competitionNodeId(selection.competitionSlug)

      // A category is addressed under its competition
      case 'category':
        return categoryNodeId(selection.competitionSlug, selection.categorySlug)

      // A round is addressed under its category when it has one
      case 'round':
        return roundNodeId(selection.competitionSlug, selection.roundSlug, selection.categorySlug)

      // A level outside the union, which the type system rules out
      default:
        return assertNever(selection)
    }
  })

  // Folded back up, so a fully-selected category reads as one chip rather than every round
  const processedSelections = buildSelectionsFromTreeIds(treeIds, baseOptions)

  // One chip per selection that survived the folding
  for (const selection of processedSelections) {
    chips.push({
      id: chipId(selection),
      displayName: selection.displayName,
      fullName: selection.fullName,
      onClick: (event: React.MouseEvent) => {
        // The modifier narrows the whole competition filter to this one selection
        if (isExclusiveSelection(event)) {
          onFiltersChange({ ...filters, contestSelection: [selection] })

          // Nothing else to do, since the modifier already settled the whole filter
          return
        }

        // A plain click drops whatever this chip stands for, leaving the rest alone
        const filteredSelections = filters.contestSelection.filter((filterSelection) => {
          switch (selection.type) {
            // The chip stands for the whole competition, so everything under it goes with it
            case 'competition':
              return filterSelection.competitionSlug !== selection.competitionSlug

            // Only the selection naming this exact category goes
            case 'category':
              return !(
                filterSelection.type === 'category' &&
                filterSelection.competitionSlug === selection.competitionSlug &&
                filterSelection.categorySlug === selection.categorySlug
              )

            // Only the selection naming this exact round goes
            case 'round':
              return !(
                filterSelection.type === 'round' &&
                filterSelection.competitionSlug === selection.competitionSlug &&
                filterSelection.categorySlug === selection.categorySlug &&
                filterSelection.roundSlug === selection.roundSlug
              )

            // A level outside the union, which the type system rules out
            default:
              return assertNever(selection)
          }
        })

        // What is left once this chip's selection is gone
        onFiltersChange({ ...filters, contestSelection: filteredSelections })
      },
    })
  }

  // Where each node sits when the hierarchy is read top to bottom
  const treeOrderMap = new Map<string, number>()

  // Bumped for every node passed, so the numbers come out in reading order
  let orderIndex = 0

  // The walk is depth-first, which is the order the tree itself renders in
  for (const competition of baseOptions.competitions) {
    // The competition leads, ahead of everything hanging off it
    treeOrderMap.set(`competition-${competition.competitionData.slug}`, orderIndex++)

    // Then each category, with its own rounds following it
    for (const category of competition.categoryData) {
      treeOrderMap.set(
        `category-${competition.competitionData.slug}-${category.categoryData.slug}`,
        orderIndex++
      )

      // The category's rounds, which sit deepest
      for (const round of category.roundData) {
        treeOrderMap.set(
          `round-${competition.competitionData.slug}-${category.categoryData.slug}-${round.slug}`,
          orderIndex++
        )
      }
    }

    // Then any rounds hanging straight off the competition, which have no category above them
    for (const round of competition.roundData) {
      treeOrderMap.set(
        `round-${competition.competitionData.slug}-${DIRECT_ROUND_KEY}-${round.slug}`,
        orderIndex++
      )
    }
  }

  // Ordered as the tree orders them, so the chips read the same way the sidebar does
  return [...chips].sort((firstChip, secondChip) => {
    // A chip the walk never reached sorts to the end
    const firstPosition = treeOrderMap.get(firstChip.id) ?? Number.MAX_SAFE_INTEGER
    const secondPosition = treeOrderMap.get(secondChip.id) ?? Number.MAX_SAFE_INTEGER

    // Earlier in the walk means earlier in the bar
    return firstPosition - secondPosition
  })
}
