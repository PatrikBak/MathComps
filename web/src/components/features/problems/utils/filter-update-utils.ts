import type { LabeledSlug } from '../types/problem-api-types'
import type { SearchFiltersState } from '../types/problem-library-types'
import { createDefaultFilters } from './url-initialization'

/**
 * Clears every filter, keeping the list being browsed: the favorites or a list.
 *
 * @param filters - The filters currently applied.
 * @returns The filters with nothing narrowing the list.
 */
export function clearFilters(filters: SearchFiltersState): SearchFiltersState {
  // Every filter at its default, the list as it was
  return {
    ...createDefaultFilters(),
    favoritesOnly: filters.favoritesOnly,
    listContentId: filters.listContentId,
  }
}

/**
 * Applies a pick of one value to a filter's values: an exclusive pick narrows the filter to that value alone, and any
 * other takes it out where it is filtered on and adds it at the end where it isn't.
 *
 * @param values - The values filtered on.
 * @param value - The value picked.
 * @param isExclusive - Whether the pick asks for that value alone.
 * @returns The values filtered on after the pick.
 */
export function toggleFilterValue(
  values: LabeledSlug[],
  value: LabeledSlug,
  isExclusive: boolean
): LabeledSlug[] {
  // An exclusive pick keeps the value alone, whether it was filtered on or not
  if (isExclusive) return [value]

  // A value filtered on comes back out
  if (values.some((existing) => existing.slug === value.slug)) {
    return values.filter((existing) => existing.slug !== value.slug)
  }

  // Any other one joins the values already there
  return [...values, value]
}

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
