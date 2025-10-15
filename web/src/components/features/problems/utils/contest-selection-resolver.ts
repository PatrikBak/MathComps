import type { ContestSelection, FilterOptionsWithCounts } from '../types/problem-library-types'

/**
 * Resolves {@link ContestSelection} labels using available competition tree data.
 * Converts slug-based labels into human-readable display names by looking up
 * competition, category, and round information from the filter options.
 *
 * @param selections - Array of contest selections with potentially slug-based labels
 * @param filterOptions - Competition tree data for label resolution, or null if unavailable
 * @returns Array of {@link ContestSelection} with resolved display labels
 */
export function resolveContestSelectionLabels(
  selections: ContestSelection[],
  filterOptions: FilterOptionsWithCounts | null
): ContestSelection[] {
  if (!filterOptions || !filterOptions.competitions || !selections.length) {
    return selections
  }

  return selections.map((selection) => {
    // Try to find the competition data
    const competitionData = filterOptions.competitions.find(
      (competition) => competition.competitionData.slug === selection.competitionSlug
    )

    if (!competitionData) {
      // Competition not found, keep original label
      return selection
    }

    const competitionLabel = competitionData.competitionData.displayName

    if (selection.type === 'competition') {
      return {
        ...selection,
        displayName: competitionLabel,
      }
    }

    if (selection.type === 'category' && selection.categorySlug) {
      // Try to find the category data
      const categoryData = competitionData.categoryData?.find(
        (category) => category.categoryData.slug === selection.categorySlug
      )

      if (categoryData) {
        return {
          ...selection,
          displayName: `${competitionLabel} - ${categoryData.categoryData.displayName}`,
        }
      } else {
        // If the competition has no categories but has a direct round matching the slug,
        // reinterpret this selection as a ROUND selection (handles memo-i style URLs)
        const directRound = competitionData.roundData?.find(
          (round) => round.slug === selection.categorySlug
        )

        if (directRound) {
          return {
            type: 'round',
            competitionSlug: selection.competitionSlug,
            categorySlug: undefined,
            roundSlug: selection.categorySlug,
            displayName: `${competitionLabel} - ${directRound.displayName}`,
          }
        }

        // Category not found, use fallback
        return {
          ...selection,
          displayName: `${competitionLabel} - ${selection.categorySlug}`,
        }
      }
    }

    if (selection.type === 'round' && selection.roundSlug) {
      let roundLabel = selection.roundSlug
      let categoryLabel = selection.categorySlug || ''

      // Try to find the round data
      if (selection.categorySlug) {
        // Round within a category
        const categoryData = competitionData.categoryData?.find(
          (category) => category.categoryData.slug === selection.categorySlug
        )

        if (categoryData) {
          categoryLabel = categoryData.categoryData.displayName
          const roundData = categoryData.roundData?.find(
            (round) => round.slug === selection.roundSlug
          )
          if (roundData) {
            roundLabel = roundData.displayName
          }
        }

        return {
          ...selection,
          displayName: `${competitionLabel} - ${categoryLabel} - ${roundLabel}`,
        }
      } else {
        // Direct round (no category)
        const roundData = competitionData.roundData?.find(
          (round) => round.slug === selection.roundSlug
        )

        if (roundData) {
          roundLabel = roundData.displayName
        }

        return {
          ...selection,
          displayName: `${competitionLabel} - ${roundLabel}`,
        }
      }
    }

    // Fallback: return original selection
    return selection
  })
}

/**
 * Determines whether {@link ContestSelection} labels need resolution from tree data.
 * Checks if selections contain slug-based labels that can be improved with
 * proper display names from available competition data.
 *
 * @param selections - Array of filter selections to check
 * @param filterOptions - Competition tree data for checking resolution availability
 * @returns True if any selections would benefit from label resolution
 */
export function needsLabelResolution(
  selections: ContestSelection[],
  filterOptions: FilterOptionsWithCounts | null
): boolean {
  if (!selections.length || !filterOptions?.competitions) {
    return false
  }

  return selections.some((selection) => {
    // Check if the label looks like a slug-based label (contains raw slugs)
    const hasSlugBasedLabel =
      selection.displayName.includes(selection.competitionSlug) &&
      (selection.categorySlug ? selection.displayName.includes(selection.categorySlug) : true) &&
      (selection.roundSlug ? selection.displayName.includes(selection.roundSlug) : true)

    if (!hasSlugBasedLabel) {
      return false
    }

    // Check if we have the tree data to resolve it
    const competitionData = filterOptions.competitions.find(
      (competition) => competition.competitionData.slug === selection.competitionSlug
    )

    return !!competitionData
  })
}
