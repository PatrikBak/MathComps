import type { SearchFiltersState } from '../types/problem-library-types'

/**
 * Counts the total number of active filters across all filter categories.
 * This count is used to enforce the maximum filter limit to prevent excessive URL length.
 *
 * Counts include:
 * - Tags (technique/topic tags)
 * - Authors
 * - Seasons (years)
 * - Problem numbers
 * - Contest selections (competitions/categories/rounds)
 * - Search text (if non-empty, counts as 1)
 *
 * @param filters - Current filter state to count
 * @returns Total number of active filters
 */
export function countActiveFilters(filters: SearchFiltersState): number {
  return (
    filters.tags.length +
    filters.authors.length +
    filters.seasons.length +
    filters.problemNumbers.length +
    (filters.contestSelection?.length ?? 0) +
    (filters.searchText.trim() ? 1 : 0)
  )
}
