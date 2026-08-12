import type { LabeledSlug } from '../types/problem-api-types'
import type { SearchFiltersState } from '../types/problem-library-types'

/**
 * Whether the only thing that changed between two filter states is what the user typed.
 * Typing arrives a character at a time, while picking a value from a list is one
 * deliberate act.
 *
 * @param previous - The filters before the change.
 * @param next - The filters after it.
 * @returns True when the text moved and every other filter stayed where it was.
 */
export function isTextOnlyChange(previous: SearchFiltersState, next: SearchFiltersState): boolean {
  // Something about the text has to have moved, while every other filter names what it named
  return (
    (previous.searchText !== next.searchText ||
      previous.searchInSolution !== next.searchInSolution) &&
    equalSlugs(previous.seasons, next.seasons) &&
    equalProblemNumbers(previous.problemNumbers, next.problemNumbers) &&
    equalSlugs(previous.tags, next.tags) &&
    previous.tagLogic === next.tagLogic &&
    equalSlugs(previous.authors, next.authors) &&
    previous.authorLogic === next.authorLogic &&
    previous.favoritesOnly === next.favoritesOnly &&
    previous.markStatus === next.markStatus &&
    previous.listContentId === next.listContentId &&
    equalContestSelections(previous.contestSelection, next.contestSelection)
  )
}

/**
 * Whether a filter change cannot possibly change the results, and so is not worth a query.
 *
 * The case worth catching is the AND/OR toggle: with one value selected or none, matching
 * any of them and matching all of them ask the same question.
 *
 * @param previous - The filters before the change.
 * @param next - The filters after it.
 * @returns True when the two states are guaranteed to return the same problems.
 */
export function isNoOpFilterChange(
  previous: SearchFiltersState,
  next: SearchFiltersState
): boolean {
  // With at most one tag selected the mode says nothing, so both modes read as one
  const normalizedPreviousTagLogic = previous.tags.length <= 1 ? 'or' : previous.tagLogic
  const normalizedNextTagLogic = next.tags.length <= 1 ? 'or' : next.tagLogic

  // The same for the authors
  const normalizedPreviousAuthorLogic = previous.authors.length <= 1 ? 'or' : previous.authorLogic
  const normalizedNextAuthorLogic = next.authors.length <= 1 ? 'or' : next.authorLogic

  // Every filter has to ask the same question, the two modes under their normalized form
  return (
    previous.searchText === next.searchText &&
    previous.searchInSolution === next.searchInSolution &&
    equalSlugs(previous.seasons, next.seasons) &&
    equalProblemNumbers(previous.problemNumbers, next.problemNumbers) &&
    equalSlugs(previous.tags, next.tags) &&
    normalizedPreviousTagLogic === normalizedNextTagLogic &&
    equalSlugs(previous.authors, next.authors) &&
    normalizedPreviousAuthorLogic === normalizedNextAuthorLogic &&
    previous.favoritesOnly === next.favoritesOnly &&
    previous.markStatus === next.markStatus &&
    previous.listContentId === next.listContentId &&
    equalContestSelections(previous.contestSelection, next.contestSelection)
  )
}

/**
 * Whether two lists of facet values name the same slugs, position for position.
 *
 * @param previous - The values before the change.
 * @param next - The values after it.
 * @returns True when both name the same values in the same order.
 */
function equalSlugs(previous: LabeledSlug[], next: LabeledSlug[]): boolean {
  // Differing counts settle it without any comparing
  if (previous.length !== next.length) return false

  // The label a value reads under carries no filtering meaning, so only its slug counts
  return previous.every((value, index) => value.slug === next[index].slug)
}

/**
 * Whether two lists of positions within a round hold the same numbers, in the same order.
 *
 * @param previous - The positions before the change.
 * @param next - The positions after it.
 * @returns True when both hold the same numbers in the same order.
 */
function equalProblemNumbers(previous: number[], next: number[]): boolean {
  // Differing counts settle it without any comparing
  if (previous.length !== next.length) return false

  // Order is meaningful here, so each position is compared against its own
  return previous.every((problemNumber, index) => problemNumber === next[index])
}

/**
 * Whether two lists of contest filters name the same nodes, position for position.
 *
 * @param previous - The selections before the change.
 * @param next - The selections after it.
 * @returns True when both name the same selections in the same order.
 */
function equalContestSelections(
  previous: SearchFiltersState['contestSelection'],
  next: SearchFiltersState['contestSelection']
): boolean {
  // Nothing handed over reads as nothing selected
  const previousArray = previous || []
  const nextArray = next || []

  // Differing counts settle it without any comparing
  if (previousArray.length !== nextArray.length) return false

  // Order is meaningful here, so each position is compared against its own
  return previousArray.every((previousSelection, index) => {
    // How the backend is told about a node follows from the node, so the path settles it alone
    return previousSelection.path === nextArray[index].path
  })
}
