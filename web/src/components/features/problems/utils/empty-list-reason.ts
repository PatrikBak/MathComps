import type { SearchFiltersState } from '../types/problem-library-types'
import { countActiveFilters } from './filter-validation'

/**
 * Why the problems under some filters came back empty.
 */
export type EmptyListReason = 'filters' | 'favorites' | 'list'

/**
 * Tells why the problems under some filters can come back empty: the filters narrowed everything away, or nothing
 * narrows the problems and the favorites or the list being browsed holds none.
 *
 * @param filters - The filters the empty list came back under.
 * @returns The reason.
 */
export function emptyListReason(filters: SearchFiltersState): EmptyListReason {
  // Anything narrowing the problems is what left none
  if (countActiveFilters(filters) > 0 || filters.markStatus !== null) return 'filters'

  // Favorites holding no problem
  if (filters.favoritesOnly) return 'favorites'

  // A list holding no problem
  if (filters.listContentId !== null) return 'list'

  // An empty archive with nothing narrowing it falls back on the filters
  return 'filters'
}
