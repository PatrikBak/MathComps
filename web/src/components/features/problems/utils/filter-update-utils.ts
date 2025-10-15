import type { SearchFiltersState } from '../types/problem-library-types'

type FilterType = 'text' | 'discrete'

/**
 * Creates a generic filter update handler with built-in business rules.
 *
 * @param filters - Current filter state
 * @param onFiltersChange - Callback to notify parent of changes
 * @returns A function that updates a specific filter property
 */
export function createFilterUpdater(
  filters: SearchFiltersState,
  onFiltersChange: (newFilters: SearchFiltersState, filterType: FilterType) => void
) {
  return <K extends keyof SearchFiltersState>(
    key: K,
    value: SearchFiltersState[K],
    type: FilterType
  ) => {
    const newFilters = { ...filters, [key]: value }

    // If search text is cleared, the 'search in solution' checkbox should also be cleared.
    if (key === 'searchText' && (!value || (typeof value === 'string' && value.trim() === ''))) {
      newFilters.searchInSolution = false
    }

    onFiltersChange(newFilters, type)
  }
}
