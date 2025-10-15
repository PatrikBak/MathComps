import type { CompetitionFilterOption } from '../types/problem-api-types'
import type { ContestSelection } from '../types/problem-library-types'

/**
 * Interprets raw URL selection parts into structured {@link ContestSelection} objects
 * using the competition tree structure for context-aware parsing.
 *
 * @param selectionParts - The raw parts from the URL, e.g., [['csmo', 'a'], ['cpsj', 'i']]
 * @param competitionsTree - The full competition options tree to use as context.
 * @returns An array of correctly typed and labeled {@link ContestSelection} objects.
 */
export function interpretSelectionParts(
  selectionParts: string[][],
  competitionsTree: CompetitionFilterOption[]
): ContestSelection[] | null {
  const selections: ContestSelection[] = []

  for (const parts of selectionParts) {
    if (parts.length === 0) continue

    const [competitionSlug, part2, part3] = parts
    const competition = competitionsTree.find((c) => c.competitionData.slug === competitionSlug)

    if (!competition) {
      console.warn(`Invalid competition slug in URL: ${competitionSlug}`)
      continue
    }

    // Case 1: Competition only (e.g., "csmo")
    if (parts.length === 1) {
      selections.push({
        type: 'competition',
        competitionSlug,
        displayName: competition.competitionData.displayName,
      })
      continue
    }

    // Case 2: Two parts (e.g., "csmo-a" or "cpsj-i")
    if (parts.length === 2) {
      // Check if it's a category
      const category = competition.categoryData.find((c) => c.categoryData.slug === part2)
      if (category) {
        selections.push({
          type: 'category',
          competitionSlug,
          categorySlug: part2,
          displayName: `${competition.competitionData.displayName} - ${category.categoryData.displayName}`,
        })
        continue
      }

      // Check if it's a direct round
      const directRound = competition.roundData.find((r) => r.slug === part2)
      if (directRound) {
        selections.push({
          type: 'round',
          competitionSlug,
          roundSlug: part2,
          displayName: `${competition.competitionData.displayName} - ${directRound.displayName}`,
        })
        continue
      }

      // If neither a category nor a direct round is found, the URL is invalid.
      return null
    }

    // Case 3: Three parts (e.g., "csmo-a-i")
    if (parts.length === 3) {
      const category = competition.categoryData.find((c) => c.categoryData.slug === part2)
      const round = category?.roundData.find((r) => r.slug === part3)

      // If the category or round doesn't exist, the URL is invalid.
      if (!category || !round) {
        console.warn(`Invalid category/round path in URL: ${competitionSlug}-${part2}-${part3}`)
        return null
      }

      selections.push({
        type: 'round',
        competitionSlug,
        categorySlug: part2,
        roundSlug: part3,
        displayName: `${competition.competitionData.displayName} - ${category.categoryData.displayName} - ${round.displayName}`,
      })
    }
  }

  return selections
}
