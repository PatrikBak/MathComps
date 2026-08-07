import type { SearchFiltersState } from '../types/problem-library-types'

/**
 * Builds the handler that writes one filter back, carrying the rules that tie filters
 * to each other.
 *
 * @param filters - The filters currently applied.
 * @param onFiltersChange - Applies the resulting filter state.
 * @returns A function taking the filter to write and its new value.
 */
export function createFilterUpdater(
  filters: SearchFiltersState,
  onFiltersChange: (newFilters: SearchFiltersState) => void
) {
  // A function which writes one filter into the state and hands the result on
  return <K extends keyof SearchFiltersState>(key: K, value: SearchFiltersState[K]) => {
    // The one filter the caller named, over everything else as it stands
    const newFilters = { ...filters, [key]: value }

    // Searching inside solutions means nothing once there is no search text to look for
    if (key === 'searchText' && (!value || (typeof value === 'string' && value.trim() === ''))) {
      newFilters.searchInSolution = false
    }

    // Hand the whole state on
    onFiltersChange(newFilters)
  }
}
