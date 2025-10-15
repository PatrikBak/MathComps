import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { buildSelectionsFromTreeIds } from './filter-ids'

/**
 * Represents a single competition filter chip displayed in the active filters bar.
 * Each chip corresponds to a competition, category, or round selection.
 */
type CompetitionChip = {
  /** Unique identifier matching the tree structure (e.g., "competition-imo", "category-csmo-a") */
  id: string
  /** Short display text shown on the chip */
  displayName: string
  /** Full descriptive name shown in tooltip when hovering over the chip */
  fullName?: string
  /** Callback invoked when user clicks the remove button on the chip */
  onRemove: () => void
}

/**
 * Generates competition chips for the active filter bar.
 * Handles hierarchical compression: competition → category → individual rounds.
 *
 * @param filters - Current filter state with selections
 * @param baseOptions - Base options for label resolution
 * @param onFiltersChange - Callback to update filters when chips are removed
 * @returns Array of chips to display
 */
export function generateCompetitionChips(
  filters: SearchFiltersState,
  baseOptions: FilterOptionsWithCounts,
  onFiltersChange: (newFilters: SearchFiltersState, type: 'discrete' | 'text') => void
): CompetitionChip[] {
  const chips: CompetitionChip[] = []

  // Early return for empty selections
  if (
    !filters.contestSelection ||
    !Array.isArray(filters.contestSelection) ||
    filters.contestSelection.length === 0
  ) {
    return chips
  }

  // #region Convert Selections to Tree IDs

  // Transform user selections into tree node IDs for processing.
  // This allows us to leverage the compression logic that understands
  // hierarchical relationships (e.g., selecting all rounds = selecting category).
  const treeIds = filters.contestSelection.map((selection) => {
    if (selection.type === 'competition') {
      return `competition/${selection.competitionSlug}`
    }
    if (selection.type === 'category') {
      return `competition/${selection.competitionSlug}/category/${selection.categorySlug}`
    }
    if (selection.categorySlug) {
      // Round within a category
      return `competition/${selection.competitionSlug}/category/${selection.categorySlug}/round/${selection.roundSlug}`
    } else {
      // Direct round (no category)
      return `competition/${selection.competitionSlug}/round/${selection.roundSlug}`
    }
  })

  // #endregion

  // #region Apply Compression and Generate Chips

  // Use a helper method to compress selections intelligently:
  // - If all rounds in a category are selected → compress to category
  // - If all categories in a competition are selected → compress to competition
  const { selections: processedSelections } = buildSelectionsFromTreeIds(treeIds, baseOptions)

  // Generate a chip for each compressed selection
  for (const selection of processedSelections) {
    // A unique id of a chip based on the selection type
    // (e.g. whether we select an entire competition / category / round)
    let chipId: string
    switch (selection.type) {
      case 'competition':
        chipId = `competition-${selection.competitionSlug}`
        break
      case 'category':
        chipId = `category-${selection.competitionSlug}-${selection.categorySlug}`
        break
      case 'round':
        chipId = `round-${selection.competitionSlug}-${selection.categorySlug || 'direct'}-${selection.roundSlug}`
        break
    }

    // Create the chip
    chips.push({
      id: chipId,
      displayName: selection.displayName,
      fullName: selection.fullName,
      onRemove: () => {
        // Remove this specific selection
        const filteredSelections = filters.contestSelection.filter((filterSelection) => {
          // The entire competition selection
          switch (selection.type) {
            case 'competition':
              // Remove all selections for this competition
              return filterSelection.competitionSlug !== selection.competitionSlug
            case 'category':
              // Remove the specific category selection
              return !(
                filterSelection.type === 'category' &&
                filterSelection.competitionSlug === selection.competitionSlug &&
                filterSelection.categorySlug === selection.categorySlug
              )
            case 'round':
              // Remove the specific round selection
              return !(
                filterSelection.type === 'round' &&
                filterSelection.competitionSlug === selection.competitionSlug &&
                filterSelection.categorySlug === selection.categorySlug &&
                filterSelection.roundSlug === selection.roundSlug
              )
          }
        })
        onFiltersChange({ ...filters, contestSelection: filteredSelections }, 'discrete')
      },
    })
  }

  // #endregion

  // #region Sort Chips by Tree Order

  // Create a position map that reflects the hierarchical order of items in the tree.
  // This ensures chips appear in the same order as they do in the TreeSelectFacet.
  const treeOrderMap = new Map<string, number>()
  let orderIndex = 0

  // Flatten the tree structure in depth-first order
  for (const competition of baseOptions.competitions) {
    // Competition level
    treeOrderMap.set(`competition-${competition.competitionData.slug}`, orderIndex++)

    // Categories within competition
    for (const category of competition.categoryData) {
      // Category level
      treeOrderMap.set(
        `category-${competition.competitionData.slug}-${category.categoryData.slug}`,
        orderIndex++
      )

      // Rounds within category
      for (const round of category.roundData) {
        treeOrderMap.set(
          `round-${competition.competitionData.slug}-${category.categoryData.slug}-${round.slug}`,
          orderIndex++
        )
      }
    }

    // Direct rounds (competitions without categories)
    for (const round of competition.roundData) {
      treeOrderMap.set(
        `round-${competition.competitionData.slug}-direct-${round.slug}`,
        orderIndex++
      )
    }
  }

  // Sort chips by their position in the tree hierarchy
  return [...chips].sort((firstChip, secondChip) => {
    const firstPosition = treeOrderMap.get(firstChip.id) ?? Number.MAX_SAFE_INTEGER
    const secondPosition = treeOrderMap.get(secondChip.id) ?? Number.MAX_SAFE_INTEGER
    return firstPosition - secondPosition
  })

  // #endregion
}
