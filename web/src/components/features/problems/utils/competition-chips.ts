import type * as React from 'react'

import { isExclusiveSelection } from '@/components/shared/utils/event-utils'

import type { SearchFiltersState } from '../types/problem-library-types'
import { foldPickedPaths } from './competition-selection-fold'
import type { CompetitionTree } from './competition-tree'

/**
 * One competition filter, as the chip standing for it.
 */
type CompetitionChip = {
  /** The node the chip stands for, as the slugs leading down to it, e.g. `csmo-a-i`. */
  id: string
  /** Every ancestor's label and the node's own, joined, e.g. "SKMO - Kategória A - Školské kolo". */
  displayName: string
  /** The node's own name in full. */
  fullName?: string
  /** Removes the selection, or narrows the filter to it alone under a modifier. */
  onClick: (event: React.MouseEvent) => void
}

/**
 * Whether a selection sits at or below a node.
 *
 * Reading descent off the path this way relies on no single slug containing the separator: a node
 * slugged `a-b` under `csmo` would read as `csmo` > `a` > `b`, and count as sitting below an
 * unrelated `csmo-a`.
 *
 * @param selection - The selection to judge.
 * @param path - The node's path.
 * @returns Whether the selection is the node itself or something below it.
 */
function isCoveredBy(selection: string, path: string): boolean {
  // The node itself, or anything deeper down the same branch
  return selection === path || selection.startsWith(`${path}-`)
}

/**
 * Builds the chips for the competitions currently filtered on, each folded up to the shallowest node
 * that covers it and ordered as the tree orders them.
 *
 * @param filters - The filters currently applied.
 * @param competitionTree - The taxonomy, which supplies both the folding and the order.
 * @param onFiltersChange - Applies the filter state a chip's click produces.
 * @returns The chips to show, in the tree's own order.
 */
export function generateCompetitionChips(
  filters: SearchFiltersState,
  competitionTree: CompetitionTree,
  onFiltersChange: (newFilters: SearchFiltersState) => void
): CompetitionChip[] {
  // No competition is filtered on
  if (
    !filters.competitionSelection ||
    !Array.isArray(filters.competitionSelection) ||
    filters.competitionSelection.length === 0
  ) {
    // Nothing to stand a chip for
    return []
  }

  // The shallowest nodes covering everything picked, in the tree's own order
  const foldedNodes = foldPickedPaths(filters.competitionSelection, competitionTree)

  // One chip per node that survived the folding
  return foldedNodes.map((node) => ({
    id: node.path,
    displayName: node.pathLabel,
    fullName: node.fullName,
    onClick: (event: React.MouseEvent) => {
      // A modifier click narrows the whole competition filter to this one node
      if (isExclusiveSelection(event)) {
        // This node alone, dropping everything else picked
        onFiltersChange({ ...filters, competitionSelection: [node.path] })

        // The filter is settled
        return
      }

      // Everything picked outside the node's subtree, which is what the chip does not stand for
      const remaining = filters.competitionSelection.filter(
        (selection) => !isCoveredBy(selection, node.path)
      )

      // Hand back the filter with this chip's branch dropped
      onFiltersChange({ ...filters, competitionSelection: remaining })
    },
  }))
}
