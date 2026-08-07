// Node ids addressing a competition, category or round, and the folding between them and
// contest selections.

import { assertNever } from '@/components/shared/utils/assert-never'

import type {
  ContestSelection,
  FilterOptionsWithCounts,
  RoundContestSelection,
} from '../types/problem-library-types'

// Constants for ID path segments
const COMPETITION_ID = 'competition'
const CATEGORY_ID = 'category'
const ROUND_ID = 'round'
const PATH_SEPARATOR = '/'

/** Stands in for the category of a round that hangs straight off its competition. */
export const DIRECT_ROUND_KEY = 'direct'

/**
 * A node id addressing a whole competition.
 */
type ParsedCompetitionId = {
  /** Names this as a competition-level id. */
  kind: 'competition'
  /** The competition the id names. */
  competition: string
}

/**
 * A node id addressing one category of a competition.
 */
type ParsedCategoryId = {
  /** Names this as a category-level id. */
  kind: 'category'
  /** The competition the category belongs to. */
  competition: string
  /** The category the id names. */
  category: string
}

/**
 * A node id addressing one round, which the id places either under a category or
 * directly under its competition.
 */
type ParsedRoundId = {
  /** Names this as a round-level id. */
  kind: 'round'
  /** The competition the round belongs to. */
  competition: string
  /** The category the round sits under, null for a round hanging off the competition. */
  category: string | null
  /** The round the id names. */
  round: string
}

/**
 * What a node id turned out to address, once read back apart.
 */
type ParsedCompositeId = ParsedCompetitionId | ParsedCategoryId | ParsedRoundId

/**
 * The slugs a selection names, with the levels it does not reach left absent.
 */
export type ContestSelectionSlugs = {
  /** The competition, which every selection names. */
  competitionSlug: string
  /** The category, absent unless the selection reaches that level. */
  categorySlug?: string
  /** The round, absent unless the selection names one. */
  roundSlug?: string
}

/**
 * Flattens a selection to the slugs it names.
 *
 * @param selection - The selection to flatten.
 * @returns Its slugs, per {@link ContestSelectionSlugs}.
 */
export function contestSelectionSlugs(selection: ContestSelection): ContestSelectionSlugs {
  switch (selection.type) {
    // A whole competition reaches no further down
    case 'competition':
      return { competitionSlug: selection.competitionSlug }

    // A category names the competition above it as well
    case 'category':
      return {
        competitionSlug: selection.competitionSlug,
        categorySlug: selection.categorySlug,
      }

    // A round names its category too, unless the competition has no category level
    case 'round':
      return {
        competitionSlug: selection.competitionSlug,
        categorySlug: selection.categorySlug,
        roundSlug: selection.roundSlug,
      }

    // A level outside the union, which the type system rules out
    default:
      return assertNever(selection)
  }
}

/**
 * Addresses a whole competition in the tree.
 *
 * @param competitionSlug - The competition to address.
 * @returns Its node id.
 */
export function competitionNodeId(competitionSlug: string): string {
  // The shortest path there is, since a competition is a root
  return `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}`
}

/**
 * Addresses one category of a competition in the tree.
 *
 * @param competitionSlug - The competition the category belongs to.
 * @param categorySlug - The category to address.
 * @returns Its node id.
 */
export function categoryNodeId(competitionSlug: string, categorySlug: string): string {
  // The competition, then the category hanging off it
  return `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}${PATH_SEPARATOR}${CATEGORY_ID}${PATH_SEPARATOR}${categorySlug}`
}

/**
 * Addresses one round in the tree, at whichever depth it hangs.
 *
 * @param competitionSlug - The competition the round belongs to.
 * @param roundSlug - The round to address.
 * @param categorySlug - The category the round sits under, omitted for a direct round.
 * @returns Its node id.
 */
export function roundNodeId(
  competitionSlug: string,
  roundSlug: string,
  categorySlug?: string
): string {
  // The path has to name the category when there is one, since round slugs repeat across them
  return categorySlug
    ? // Competition, category, round
      `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}${PATH_SEPARATOR}${CATEGORY_ID}${PATH_SEPARATOR}${categorySlug}${PATH_SEPARATOR}${ROUND_ID}${PATH_SEPARATOR}${roundSlug}`
    : // Competition, then the round straight off it
      `${COMPETITION_ID}${PATH_SEPARATOR}${competitionSlug}${PATH_SEPARATOR}${ROUND_ID}${PATH_SEPARATOR}${roundSlug}`
}

/**
 * Reads a node id back into the level it addresses and the slugs it names.
 *
 * @param id - The node id to read.
 * @returns What the id addresses, or null when it is not a well-formed node id.
 */
function parseCompositeId(id: string): ParsedCompositeId | null {
  // Every node id starts at a competition, so anything else is not one
  if (!id.startsWith(`${COMPETITION_ID}${PATH_SEPARATOR}`)) return null

  // The path segments, whose count and labels are what tell the levels apart
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

  // A shape none of the levels produce
  return null
}

/**
 * Gathers selections under the competition each one belongs to, since a selection can
 * only ever fold into another from the same competition.
 *
 * @param selections - The selections to gather.
 * @returns The selections per competition slug, each keeping its incoming order.
 */
function groupByCompetition(selections: ContestSelection[]): Map<string, ContestSelection[]> {
  // Filled in as each selection finds its competition
  const grouped = new Map<string, ContestSelection[]>()

  // Each selection joins the bucket of the competition it names
  for (const selection of selections) {
    // The first selection of a competition is what opens its bucket
    if (!grouped.has(selection.competitionSlug)) {
      grouped.set(selection.competitionSlug, [])
    }

    // The bucket is there either way by now, so the selection can just join it
    grouped.get(selection.competitionSlug)!.push(selection)
  }

  // One bucket per competition that had anything selected in it
  return grouped
}

/**
 * Turns the nodes the tree has selected into the selections the filters hold, folding
 * each set of siblings back up to the shallowest node that covers it: every round of a
 * category becomes the category, and every category of a competition becomes the
 * competition. Folding runs twice over, since collapsing rounds into a category can be
 * what completes the set of categories that then collapses into the competition.
 *
 * @param selectedIds - The tree nodes selected in their own right.
 * @param baseOptions - The whole hierarchy, which says what a complete set of siblings is.
 * @returns The selections, each held at the shallowest level that covers it.
 */
export function buildSelectionsFromTreeIds(
  selectedIds: string[],
  baseOptions: FilterOptionsWithCounts
): ContestSelection[] {
  // One selection per node, before any folding
  const preliminarySelections: ContestSelection[] = []

  // The node ids that read back into a level, the rest dropped
  const parsed = selectedIds
    .map((selectedId) => parseCompositeId(selectedId))
    .filter((parsedId): parsedId is ParsedCompositeId => parsedId !== null)

  // Each node becomes a selection carrying the names it reads under
  for (const parsedSelection of parsed) {
    // The competition the node belongs to, which every level needs for its label
    const competition = baseOptions.competitions.find(
      (competitionOption) => competitionOption.competitionData.slug === parsedSelection.competition
    )

    // A node naming a competition the hierarchy does not hold is dropped
    if (!competition) continue

    // The competition's name, which every label below starts with
    const competitionName = competition.competitionData.displayName

    // Each level reads under a different label, and needs a different lookup to build it
    switch (parsedSelection.kind) {
      case 'competition':
        // A whole competition reads under its own name and needs nothing looked up
        preliminarySelections.push({
          type: 'competition',
          competitionSlug: parsedSelection.competition,
          displayName: competitionName,
        })

        break

      case 'category': {
        // The category the node names, which supplies the second half of the label
        const category = competition.categoryData.find(
          (categoryOption) => categoryOption.categoryData.slug === parsedSelection.category
        )

        // A category the competition does not hold is dropped
        if (category) {
          // Both names together, since a category name alone says nothing about which competition
          preliminarySelections.push({
            type: 'category',
            competitionSlug: parsedSelection.competition,
            categorySlug: parsedSelection.category,
            displayName: `${competitionName} - ${category.categoryData.displayName}`,
          })
        }

        break
      }

      case 'round': {
        // Filled in from whichever level the round hangs off
        let roundLabel: string

        // A round under a category reads with all three names
        if (parsedSelection.category) {
          // The category the round sits under
          const category = competition.categoryData.find(
            (categoryOption) => categoryOption.categoryData.slug === parsedSelection.category
          )

          // The round itself, looked up within that category
          const round = category?.roundData.find(
            (roundOption) => roundOption.slug === parsedSelection.round
          )

          // A category or round the hierarchy does not hold means the node is dropped
          if (!category || !round) continue

          // All three levels, since a round name repeats across categories
          roundLabel = `${competitionName} - ${category.categoryData.displayName} - ${round.displayName}`
        } else {
          // A round hanging straight off the competition, which has no category to name
          const round = competition.roundData.find(
            (roundOption) => roundOption.slug === parsedSelection.round
          )

          // A round the competition does not hold means the node is dropped
          if (!round) continue

          // Only the two levels there are
          roundLabel = `${competitionName} - ${round.displayName}`
        }

        // The category rides along when there is one, which is what places the round later
        preliminarySelections.push({
          type: 'round',
          competitionSlug: parsedSelection.competition,
          categorySlug: parsedSelection.category || undefined,
          roundSlug: parsedSelection.round,
          displayName: roundLabel,
        })

        break
      }

      // A level outside the union, which the type system rules out
      default:
        return assertNever(parsedSelection)
    }
  }

  // The first fold: complete sets of rounds give way to the category above them
  const finalSelections: ContestSelection[] = []

  // Folding only ever happens within one competition, so work a competition at a time
  const selectionsByCompetition = groupByCompetition(preliminarySelections)

  // Each competition's selections fold among themselves and nothing else
  for (const [competitionSlug, competitionSelections] of selectionsByCompetition) {
    // The competition's own hierarchy, which says what a complete set of rounds is
    const competition = baseOptions.competitions.find(
      (competitionOption) => competitionOption.competitionData.slug === competitionSlug
    )

    // A competition the hierarchy does not hold cannot be folded against
    if (!competition) continue

    // The whole competition already covers everything under it
    const hasCompetitionSelection = competitionSelections.some(
      (selection) => selection.type === 'competition'
    )

    // Nothing below it is worth keeping alongside it
    if (hasCompetitionSelection) {
      finalSelections.push(
        ...competitionSelections.filter((selection) => selection.type === 'competition')
      )

      continue
    }

    // The two levels that can still appear, which fold against each other below
    const categorySelections = competitionSelections.filter(
      (selection) => selection.type === 'category'
    )
    const roundSelections = competitionSelections.filter((selection) => selection.type === 'round')

    // A category picked outright survives the fold as it is
    finalSelections.push(...categorySelections)

    // Rounds fold per category, so they have to be gathered under the one they sit in
    const roundsByCategory = new Map<string, RoundContestSelection[]>()

    // Each round joins the bucket of the category it sits under
    for (const roundSelection of roundSelections) {
      // Rounds hanging off the competition share one bucket of their own
      const key = roundSelection.categorySlug || DIRECT_ROUND_KEY

      // The first round of a category is what opens its bucket
      if (!roundsByCategory.has(key)) {
        roundsByCategory.set(key, [])
      }

      // The bucket is there either way by now, so the round can just join it
      roundsByCategory.get(key)!.push(roundSelection)
    }

    // Each category's rounds fold on their own, since a set is complete per category
    for (const [categoryKey, rounds] of roundsByCategory) {
      // Rounds with no category above them have nothing to fold into at this level
      if (categoryKey === DIRECT_ROUND_KEY) {
        // They survive as they are, and the second fold gets its own go at them
        finalSelections.push(...rounds)

        continue
      }

      // The category was picked outright, so it already stands for these rounds
      const isCategoryExplicitlySelected = categorySelections.some(
        (categorySelection) => categorySelection.categorySlug === categoryKey
      )

      // Keeping them alongside it would record the same branch twice
      if (isCategoryExplicitlySelected) continue

      // The category's own rounds, which is what a complete set is measured against
      const category = competition.categoryData.find(
        (categoryOption) => categoryOption.categoryData.slug === categoryKey
      )

      // A category the hierarchy does not hold cannot be folded into
      if (!category) {
        // The rounds survive individually, since nothing is known to cover them
        finalSelections.push(...rounds)

        continue
      }

      // Every round the category has, against the ones the user picked
      const allCategoryRounds = category.roundData.map((roundOption) => roundOption.slug)
      const selectedRoundSlugs = rounds.map((roundSelection) => roundSelection.roundSlug)

      // A partial set stays as it is, since no single node covers exactly those rounds
      if (
        allCategoryRounds.length !== selectedRoundSlugs.length ||
        !allCategoryRounds.every((slug) => selectedRoundSlugs.includes(slug))
      ) {
        // The rounds survive individually, each naming itself
        finalSelections.push(...rounds)

        continue
      }

      // The whole category is covered, so it stands in for every round under it
      finalSelections.push({
        type: 'category',
        competitionSlug: competitionSlug,
        categorySlug: categoryKey,
        displayName: `${competition.competitionData.displayName} - ${category.categoryData.displayName}`,
      })
    }
  }

  // The second fold: complete sets of categories now give way to the competition above them
  const foldedSelections: ContestSelection[] = []

  // Gathered afresh, since the first fold changed what each competition holds
  const finalSelectionsByCompetition = groupByCompetition(finalSelections)

  // Each competition's selections fold among themselves and nothing else
  for (const [competitionSlug, competitionSelections] of finalSelectionsByCompetition) {
    // The competition's own hierarchy, which says what a complete set of children is
    const competition = baseOptions.competitions.find(
      (competitionOption) => competitionOption.competitionData.slug === competitionSlug
    )

    // A competition the hierarchy does not hold cannot be folded against
    if (!competition) continue

    // The whole competition already covers everything under it
    const hasCompetitionSelection = competitionSelections.some(
      (selection) => selection.type === 'competition'
    )

    // Nothing below it is worth keeping alongside it
    if (hasCompetitionSelection) {
      // Only the competition itself survives, and its descendants are dropped
      foldedSelections.push(
        ...competitionSelections.filter((selection) => selection.type === 'competition')
      )

      continue
    }

    // The competition's children are its categories, so those are what have to be complete
    if (competition.categoryData.length > 0) {
      // Every category the competition has, against the ones now selected
      const categorySelections = competitionSelections.filter(
        (selection) => selection.type === 'category'
      )
      const allCategorySlugs = competition.categoryData.map(
        (categoryOption) => categoryOption.categoryData.slug
      )
      const selectedCategorySlugs = categorySelections.map(
        (categorySelection) => categorySelection.categorySlug
      )

      // A leftover round means some category is only partly covered, whatever the counts say
      const hasIndividualRounds = competitionSelections.some(
        (selection) => selection.type === 'round'
      )

      // Anything short of every category stays as it is
      if (
        hasIndividualRounds ||
        allCategorySlugs.length !== selectedCategorySlugs.length ||
        !allCategorySlugs.every((slug) => selectedCategorySlugs.includes(slug))
      ) {
        // The selections survive at whatever level the first fold left them
        foldedSelections.push(...competitionSelections)

        continue
      }

      // Every category is covered, so the competition stands in for all of them
      foldedSelections.push({
        type: 'competition',
        competitionSlug: competitionSlug,
        displayName: competition.competitionData.displayName,
      })
    } else {
      // With no category level, the competition's children are its rounds
      const roundSelections = competitionSelections.filter(
        (selection) => selection.type === 'round'
      )
      const allDirectRounds = competition.roundData.map((roundOption) => roundOption.slug)
      const selectedRoundSlugs = roundSelections.map((roundSelection) => roundSelection.roundSlug)

      // Anything short of every round stays as it is, and a competition with no rounds folds into nothing
      if (
        allDirectRounds.length === 0 ||
        allDirectRounds.length !== selectedRoundSlugs.length ||
        !allDirectRounds.every((slug) => selectedRoundSlugs.includes(slug))
      ) {
        // The rounds survive individually, each naming itself
        foldedSelections.push(...competitionSelections)

        continue
      }

      // Every round is covered, so the competition stands in for all of them
      foldedSelections.push({
        type: 'competition',
        competitionSlug: competitionSlug,
        displayName: competition.competitionData.displayName,
      })
    }
  }

  // Each selection now sits at the shallowest node that covers it
  return foldedSelections
}
