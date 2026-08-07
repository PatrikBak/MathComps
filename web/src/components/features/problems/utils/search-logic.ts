import type { SearchFiltersState } from '../types/problem-library-types'
import { contestSelectionSlugs } from './filter-ids'

/** How short a search term may be before it needs another filter to justify a query. */
const MIN_STANDALONE_SEARCH_LENGTH = 3

/**
 * Whether a filter state is worth querying for. A term of one or two characters matches
 * most of the library, so it only earns a query once something else narrows the results.
 *
 * @param searchFilters - The filters currently applied.
 * @returns True when the filters should produce a query.
 */
export function shouldTriggerSearch(searchFilters: SearchFiltersState): boolean {
  // A term too short to narrow anything on its own
  if (searchFilters.searchText && searchFilters.searchText.length < MIN_STANDALONE_SEARCH_LENGTH) {
    // Whether anything else is set that would narrow the results instead
    const hasOtherFilters =
      searchFilters.seasons.length > 0 ||
      searchFilters.tags.length > 0 ||
      searchFilters.authors.length > 0 ||
      searchFilters.problemNumbers.length > 0 ||
      (searchFilters.contestSelection && searchFilters.contestSelection.length > 0) ||
      searchFilters.favoritesOnly ||
      searchFilters.markStatus != null ||
      searchFilters.listContentId != null

    // A short term standing alone would return most of the library
    if (!hasOtherFilters) return false
  }

  // Everything else is worth querying for
  return true
}

/**
 * Whether the only thing that changed between two filter states is what the user typed.
 * Typing arrives a character at a time, while picking a value from a list is one
 * deliberate act.
 *
 * @param prev - The filters before the change.
 * @param next - The filters after it.
 * @returns True when nothing but the search text and its scope moved.
 */
export function isTextOnlyChange(prev: SearchFiltersState, next: SearchFiltersState): boolean {
  // Something about the text has to have moved, and everything else has to have stayed put
  return (
    (prev.searchText !== next.searchText || prev.searchInSolution !== next.searchInSolution) &&
    prev.seasons.length === next.seasons.length &&
    prev.problemNumbers.length === next.problemNumbers.length &&
    prev.tags.length === next.tags.length &&
    prev.tagLogic === next.tagLogic &&
    prev.authors.length === next.authors.length &&
    prev.authorLogic === next.authorLogic &&
    prev.favoritesOnly === next.favoritesOnly &&
    prev.markStatus === next.markStatus &&
    prev.listContentId === next.listContentId &&
    equalSelectionsArrays(prev.contestSelection, next.contestSelection)
  )
}

/**
 * Whether a filter change cannot possibly change the results, and so is not worth a query.
 *
 * The case worth catching is the AND/OR toggle: with one value selected or none, matching
 * any of them and matching all of them ask the same question.
 *
 * @param prev - The filters before the change.
 * @param next - The filters after it.
 * @returns True when the two states are guaranteed to return the same problems.
 */
export function isNoOpFilterChange(prev: SearchFiltersState, next: SearchFiltersState): boolean {
  // With at most one value selected the mode says nothing, so both modes read as one
  const normalizedPrevTagLogic = prev.tags.length <= 1 ? 'or' : prev.tagLogic
  const normalizedNextTagLogic = next.tags.length <= 1 ? 'or' : next.tagLogic
  const normalizedPrevAuthorLogic = prev.authors.length <= 1 ? 'or' : prev.authorLogic
  const normalizedNextAuthorLogic = next.authors.length <= 1 ? 'or' : next.authorLogic

  // Every filter has to ask the same question, the two modes under their normalized form
  return (
    prev.searchText === next.searchText &&
    prev.searchInSolution === next.searchInSolution &&
    prev.seasons.length === next.seasons.length &&
    prev.problemNumbers.length === next.problemNumbers.length &&
    prev.tags.length === next.tags.length &&
    normalizedPrevTagLogic === normalizedNextTagLogic &&
    prev.authors.length === next.authors.length &&
    normalizedPrevAuthorLogic === normalizedNextAuthorLogic &&
    prev.favoritesOnly === next.favoritesOnly &&
    prev.markStatus === next.markStatus &&
    prev.listContentId === next.listContentId &&
    equalSelectionsArrays(prev.contestSelection, next.contestSelection) &&
    prev.seasons.every((season, index) => season.slug === next.seasons[index].slug) &&
    prev.tags.every((tag, index) => tag.slug === next.tags[index].slug) &&
    prev.authors.every((author, index) => author.slug === next.authors[index].slug) &&
    prev.problemNumbers.every((number, index) => number === next.problemNumbers[index])
  )
}

/**
 * Whether two competition filters name the same thing, position for position.
 *
 * @param previous - The selections before the change.
 * @param next - The selections after it.
 * @returns True when both name the same selections in the same order.
 */
function equalSelectionsArrays(
  previous: SearchFiltersState['contestSelection'],
  next: SearchFiltersState['contestSelection']
): boolean {
  // A selection arriving from the URL may be absent altogether
  const previousArray = previous || []
  const nextArray = next || []

  // Differing counts settle it without any comparing
  if (previousArray.length !== nextArray.length) return false

  // Order is meaningful here, so each position is compared against its own
  return previousArray.every((previousSelection, index) => {
    // The selection sitting in the same place on the other side
    const nextSelection = nextArray[index]

    // The names a selection reads under carry no filtering meaning, so only the slugs count
    const previousSlugs = contestSelectionSlugs(previousSelection)
    const nextSlugs = contestSelectionSlugs(nextSelection)

    // The level and all three slugs have to agree
    return (
      previousSelection.type === nextSelection.type &&
      previousSlugs.competitionSlug === nextSlugs.competitionSlug &&
      previousSlugs.categorySlug === nextSlugs.categorySlug &&
      previousSlugs.roundSlug === nextSlugs.roundSlug
    )
  })
}
