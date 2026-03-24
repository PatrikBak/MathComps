import type { SearchFiltersState } from '../types/problem-library-types'

/**
 * Determines if a search should be triggered based on the current filter state.
 *
 * @param searchFilters - The current state of all search filters
 * @returns true if a search should be performed, false otherwise
 */
export function shouldTriggerSearch(searchFilters: SearchFiltersState): boolean {
  if (searchFilters.searchText && searchFilters.searchText.length < 3) {
    const hasOtherFilters =
      searchFilters.seasons.length > 0 ||
      searchFilters.tags.length > 0 ||
      searchFilters.authors.length > 0 ||
      searchFilters.problemNumbers.length > 0 ||
      (searchFilters.contestSelection && searchFilters.contestSelection.length > 0) ||
      searchFilters.favoritesOnly ||
      searchFilters.markStatus != null ||
      searchFilters.listContentId != null
    if (!hasOtherFilters) return false
  }
  return true
}

/**
 * Determines if a filter change is text-only (searchText or searchInSolution).
 * Used to determine if changes should be debounced (text-only) or applied immediately (discrete).
 *
 * @param prev - The previous filter state
 * @param next - The new filter state
 * @returns true if only text-related fields changed, false if any discrete filters changed
 */
export function isTextOnlyChange(prev: SearchFiltersState, next: SearchFiltersState): boolean {
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
 * Determines if a filter change is a no-op, meaning it can't produce different search results.
 * Currently detects: toggling tagLogic or authorLogic when ≤1 item is selected
 * (because OR and AND are equivalent with a single operand).
 *
 * @param prev - The previous filter state
 * @param next - The new filter state
 * @returns true if the change is guaranteed to produce identical results
 */
export function isNoOpFilterChange(prev: SearchFiltersState, next: SearchFiltersState): boolean {
  // Normalize: treat OR and AND as equivalent when ≤1 item is selected
  const normalizedPrevTagLogic = prev.tags.length <= 1 ? 'or' : prev.tagLogic
  const normalizedNextTagLogic = next.tags.length <= 1 ? 'or' : next.tagLogic
  const normalizedPrevAuthorLogic = prev.authors.length <= 1 ? 'or' : prev.authorLogic
  const normalizedNextAuthorLogic = next.authors.length <= 1 ? 'or' : next.authorLogic

  // Compare everything using the normalized logic values
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
 * Compares two selections arrays for equality
 */
function equalSelectionsArrays(
  previous: SearchFiltersState['contestSelection'],
  next: SearchFiltersState['contestSelection']
): boolean {
  const previousArray = previous || []
  const nextArray = next || []

  if (previousArray.length !== nextArray.length) return false

  return previousArray.every((previousSelection, index) => {
    const nextSelection = nextArray[index]
    return (
      previousSelection.type === nextSelection.type &&
      previousSelection.competitionSlug === nextSelection.competitionSlug &&
      previousSelection.categorySlug === nextSelection.categorySlug &&
      previousSelection.roundSlug === nextSelection.roundSlug
    )
  })
}
