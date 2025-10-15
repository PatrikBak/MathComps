// Utility helpers for building and parsing composite IDs used by
// competition/category/round tree selections and chips.

import type { ContestSelection, FilterOptionsWithCounts } from '../types/problem-library-types'

// Constants for ID path segments
const COMPETITION_ID = 'competition'
const CATEGORY_ID = 'category'
const ROUND_ID = 'round'
const PATH_SEPARATOR = '/'

type ParsedCompositeId =
  | { kind: 'competition'; competition: string }
  | { kind: 'category'; competition: string; category: string }
  | { kind: 'round'; competition: string; category?: string | null; round: string }

/**
 * Generates a competition node ID for tree selection.
 *
 * @param competitionSlug - The competition slug identifier
 * @returns The formatted competition node ID
 */
export function competitionNodeId(competitionSlug: string): string {
  return `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}`
}

/**
 * Generates a category node ID for tree selection.
 *
 * @param competitionSlug - The competition slug identifier
 * @param categorySlug - The category slug identifier
 * @returns The formatted category node ID
 */
export function categoryNodeId(competitionSlug: string, categorySlug: string): string {
  return `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}${PATH_SEPARATOR}${CATEGORY_ID}${PATH_SEPARATOR}${categorySlug}`
}

/**
 * Generates a round node ID for tree selection.
 *
 * @param competitionSlug - The competition slug identifier
 * @param roundSlug - The round slug identifier
 * @param categorySlug - The optional category slug identifier (for categorized rounds)
 * @returns The formatted round node ID
 */
export function roundNodeId(
  competitionSlug: string,
  roundSlug: string,
  categorySlug?: string
): string {
  return categorySlug
    ? `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}${PATH_SEPARATOR}${CATEGORY_ID}${PATH_SEPARATOR}${categorySlug}${PATH_SEPARATOR}${ROUND_ID}${PATH_SEPARATOR}${roundSlug}`
    : `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}${PATH_SEPARATOR}${ROUND_ID}${PATH_SEPARATOR}${roundSlug}`
}

function parseCompositeId(id: string): ParsedCompositeId | null {
  if (!id.startsWith(`${COMPETITION_ID}${PATH_SEPARATOR}`)) return null
  const parts = id.split(PATH_SEPARATOR)
  // competition/<competition>
  if (parts.length === 2) return { kind: 'competition', competition: parts[1] }
  // competition/<competition>/round/<round>
  if (parts.length === 4 && parts[2] === ROUND_ID) {
    return { kind: 'round', competition: parts[1], category: null, round: parts[3] }
  }
  // competition/<competition>/category/<category>
  if (parts.length === 4 && parts[2] === CATEGORY_ID) {
    return { kind: 'category', competition: parts[1], category: parts[3] }
  }
  // competition/<competition>/category/<category>/round/<round>
  if (parts.length === 6 && parts[2] === CATEGORY_ID && parts[4] === ROUND_ID) {
    return { kind: 'round', competition: parts[1], category: parts[3], round: parts[5] }
  }
  return null
}

/**
 * Converts tree selection IDs to ContestSelection objects with full context.
 * Implements intelligent compression logic that combines individual round selections
 * back to categories/competitions when all children are selected. This is the most
 * complex function in the filter system, handling multi-level hierarchical compression.
 *
 * @param selectedIds - Array of tree node IDs that are currently selected
 * @param baseOptions - The complete filter options data for lookup and validation
 * @returns Object containing the compressed array of ContestSelection objects
 */
export function buildSelectionsFromTreeIds(
  selectedIds: string[],
  baseOptions: FilterOptionsWithCounts
): {
  selections: ContestSelection[]
} {
  const preliminarySelections: ContestSelection[] = []
  const competitionSet = new Set<string>()
  const roundMap = new Map<string, { data: string; slug: string }>()

  // Parse all selected IDs
  const parsed = selectedIds
    .map((selectedId) => parseCompositeId(selectedId))
    .filter((parsedId): parsedId is ParsedCompositeId => parsedId !== null)

  // Process each parsed selection
  for (const parsedSelection of parsed) {
    // Find competition data
    const competition = baseOptions.competitions.find(
      (competitionOption) => competitionOption.competitionData.slug === parsedSelection.competition
    )
    if (!competition) continue

    const competitionName = competition.competitionData.displayName

    switch (parsedSelection.kind) {
      case 'competition':
        preliminarySelections.push({
          type: 'competition',
          competitionSlug: parsedSelection.competition,
          displayName: competitionName,
        })
        competitionSet.add(parsedSelection.competition)
        break

      case 'category':
        const category = competition.categoryData.find(
          (categoryOption) => categoryOption.categoryData.slug === parsedSelection.category
        )
        if (category) {
          preliminarySelections.push({
            type: 'category',
            competitionSlug: parsedSelection.competition,
            categorySlug: parsedSelection.category,
            displayName: `${competitionName} - ${category.categoryData.displayName}`,
          })
          competitionSet.add(parsedSelection.competition)

          // Add all rounds from this category to the rounds map for API compatibility
          category.roundData.forEach((roundOption) => {
            roundMap.set(roundOption.slug, {
              data: roundOption.displayName,
              slug: roundOption.slug,
            })
          })
        }
        break

      case 'round':
        let roundLabel: string
        let roundData: string

        if (parsedSelection.category) {
          // Round within a category
          const category = competition.categoryData.find(
            (categoryOption) => categoryOption.categoryData.slug === parsedSelection.category
          )
          const round = category?.roundData.find(
            (roundOption) => roundOption.slug === parsedSelection.round
          )
          if (category && round) {
            roundLabel = `${competitionName} - ${category.categoryData.displayName} - ${round.displayName}`
            roundData = round.displayName
          } else {
            continue // Skip if category/round not found
          }
        } else {
          // Direct round (no category)
          const round = competition.roundData.find(
            (roundOption) => roundOption.slug === parsedSelection.round
          )
          if (round) {
            roundLabel = `${competitionName} - ${round.displayName}`
            roundData = round.displayName
          } else {
            continue // Skip if round not found
          }
        }

        preliminarySelections.push({
          type: 'round',
          competitionSlug: parsedSelection.competition,
          categorySlug: parsedSelection.category || undefined,
          roundSlug: parsedSelection.round,
          displayName: roundLabel,
        })

        competitionSet.add(parsedSelection.competition)
        roundMap.set(parsedSelection.round, { data: roundData, slug: parsedSelection.round })
        break
    }
  }

  // Smart compression: convert individual round selections back to categories when complete
  const finalSelections: ContestSelection[] = []

  // Group preliminary selections by competition
  const selectionsByCompetition = new Map<string, ContestSelection[]>()
  for (const selection of preliminarySelections) {
    if (!selectionsByCompetition.has(selection.competitionSlug)) {
      selectionsByCompetition.set(selection.competitionSlug, [])
    }
    selectionsByCompetition.get(selection.competitionSlug)!.push(selection)
  }

  for (const [competitionSlug, competitionSelections] of selectionsByCompetition) {
    const competition = baseOptions.competitions.find(
      (competitionOption) => competitionOption.competitionData.slug === competitionSlug
    )
    if (!competition) continue

    // Check if entire competition is selected
    const hasCompetitionSelection = competitionSelections.some(
      (selection) => selection.type === 'competition'
    )
    if (hasCompetitionSelection) {
      finalSelections.push(
        ...competitionSelections.filter((selection) => selection.type === 'competition')
      )
      continue
    }

    // Check if we can compress individual rounds to categories
    const categorySelections = competitionSelections.filter(
      (selection) => selection.type === 'category'
    )
    const roundSelections = competitionSelections.filter((selection) => selection.type === 'round')

    // Add explicit category selections
    finalSelections.push(...categorySelections)

    // Group round selections by category
    const roundsByCategory = new Map<string, ContestSelection[]>()
    for (const roundSelection of roundSelections) {
      const key = roundSelection.categorySlug || 'direct'
      if (!roundsByCategory.has(key)) {
        roundsByCategory.set(key, [])
      }
      roundsByCategory.get(key)!.push(roundSelection)
    }

    // Process each category
    for (const [categoryKey, rounds] of roundsByCategory) {
      if (categoryKey === 'direct') {
        // Direct rounds - add them as-is (TODO: could compress to competition level if all direct rounds selected)
        finalSelections.push(...rounds)
        continue
      }

      // Check if this category is already explicitly selected
      const isCategoryExplicitlySelected = categorySelections.some(
        (categorySelection) => categorySelection.categorySlug === categoryKey
      )
      if (isCategoryExplicitlySelected) {
        // Skip individual rounds for this category
        continue
      }

      // Check if all rounds in this category are selected
      const category = competition.categoryData.find(
        (categoryOption) => categoryOption.categoryData.slug === categoryKey
      )
      if (category) {
        const allCategoryRounds = category.roundData.map((roundOption) => roundOption.slug)
        const selectedRoundSlugs = rounds.map((roundSelection) => roundSelection.roundSlug!)

        if (
          allCategoryRounds.length === selectedRoundSlugs.length &&
          allCategoryRounds.every((slug) => selectedRoundSlugs.includes(slug))
        ) {
          // All rounds in this category are selected - compress to category
          finalSelections.push({
            type: 'category',
            competitionSlug: competitionSlug,
            categorySlug: categoryKey,
            displayName: `${competition.competitionData.displayName} - ${category.categoryData.displayName}`,
          })
        } else {
          // Only some rounds selected - keep individual rounds
          finalSelections.push(...rounds)
        }
      } else {
        // Category not found - keep individual rounds
        finalSelections.push(...rounds)
      }
    }
  }

  // Multi-level compression: check if we can compress categories to entire competitions
  const ultraFinalSelections: ContestSelection[] = []

  // Group final selections by competition again for competition-level compression
  const finalSelectionsByCompetition = new Map<string, ContestSelection[]>()
  for (const selection of finalSelections) {
    if (!finalSelectionsByCompetition.has(selection.competitionSlug)) {
      finalSelectionsByCompetition.set(selection.competitionSlug, [])
    }
    finalSelectionsByCompetition.get(selection.competitionSlug)!.push(selection)
  }

  for (const [competitionSlug, competitionSelections] of finalSelectionsByCompetition) {
    const competition = baseOptions.competitions.find(
      (competitionOption) => competitionOption.competitionData.slug === competitionSlug
    )
    if (!competition) continue

    // Check if entire competition is already explicitly selected
    const hasCompetitionSelection = competitionSelections.some(
      (selection) => selection.type === 'competition'
    )
    if (hasCompetitionSelection) {
      ultraFinalSelections.push(
        ...competitionSelections.filter((selection) => selection.type === 'competition')
      )
      continue
    }

    // Check if all categories are selected (for competitions with categories)
    if (competition.categoryData.length > 0) {
      const categorySelections = competitionSelections.filter(
        (selection) => selection.type === 'category'
      )
      const allCategorySlugs = competition.categoryData.map(
        (categoryOption) => categoryOption.categoryData.slug
      )
      const selectedCategorySlugs = categorySelections.map(
        (categorySelection) => categorySelection.categorySlug!
      )

      // Check if all categories are selected and no individual rounds exist
      const hasIndividualRounds = competitionSelections.some(
        (selection) => selection.type === 'round'
      )

      if (
        !hasIndividualRounds &&
        allCategorySlugs.length === selectedCategorySlugs.length &&
        allCategorySlugs.every((slug) => selectedCategorySlugs.includes(slug))
      ) {
        // All categories are selected - compress to entire competition
        ultraFinalSelections.push({
          type: 'competition',
          competitionSlug: competitionSlug,
          displayName: competition.competitionData.displayName,
        })
      } else {
        // Keep individual category/round selections
        ultraFinalSelections.push(...competitionSelections)
      }
    } else {
      // Competition has no categories - check if all direct rounds are selected
      const roundSelections = competitionSelections.filter(
        (selection) => selection.type === 'round'
      )
      const allDirectRounds = competition.roundData.map((roundOption) => roundOption.slug)
      const selectedRoundSlugs = roundSelections.map((roundSelection) => roundSelection.roundSlug!)

      if (
        allDirectRounds.length > 0 &&
        allDirectRounds.length === selectedRoundSlugs.length &&
        allDirectRounds.every((slug) => selectedRoundSlugs.includes(slug))
      ) {
        // All direct rounds selected - compress to competition
        ultraFinalSelections.push({
          type: 'competition',
          competitionSlug: competitionSlug,
          displayName: competition.competitionData.displayName,
        })
      } else {
        // Keep individual round selections
        ultraFinalSelections.push(...competitionSelections)
      }
    }
  }

  return { selections: ultraFinalSelections }
}
