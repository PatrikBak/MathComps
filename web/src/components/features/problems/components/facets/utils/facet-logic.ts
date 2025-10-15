import { normalizeForSearch } from '@/components/shared/utils/string-utils'

import type { FacetOption } from '../facet-shared'

/**
 * Toggles an option's selection state in a multi-select facet.
 * Adds the option if not present, removes it if already selected.
 * Maintains immutability by returning a new array.
 *
 * @param optionId - The ID of the option to toggle
 * @param selectedIds - Array of currently selected option IDs
 * @returns New array with the option added or removed
 */
export function toggleOptionSelection(optionId: string, selectedIds: string[]): string[] {
  // Check if option is currently selected
  if (selectedIds.includes(optionId)) {
    // Remove from selection: filter out the target option ID
    return selectedIds.filter((id) => id !== optionId)
  } else {
    // Add to selection: create new array with existing selections plus new option
    return [...selectedIds, optionId]
  }
}

/**
 * Filters facet options by a search term, case-insensitively and diacritics-insensitively.
 * This enables users to search Slovak text without worrying about exact casing or diacritical marks.
 * For example, searching "cisla" will match "Čísla", and "STATISTIKA" will match "Štatistika".
 *
 * @param options - Array of facet options to filter
 * @param searchTerm - The search query to filter by (supports partial matches)
 * @returns Filtered array of options matching the normalized search term
 */
export function filterOptionsBySearch(options: FacetOption[], searchTerm: string): FacetOption[] {
  // Early return: no filtering needed when search is empty
  if (!searchTerm) return options

  // Normalize search term once for efficiency (lowercase, no diacritics)
  const normalizedSearch = normalizeForSearch(searchTerm)

  // Filter options by normalized partial match on display name
  return options.filter((option) =>
    normalizeForSearch(option.displayName).includes(normalizedSearch)
  )
}

/**
 * Gets visible options including selected items even if they don't match the search term.
 * This prevents user confusion when their selections "disappear" during search.
 *
 * Business rule: Always show selected options in the list, regardless of search,
 * so users can see and deselect them. Combine with search-matched options for complete visibility.
 *
 * @param options - Full array of available facet options
 * @param selectedIds - Set of currently selected option IDs
 * @param searchTerm - The search query to filter by
 * @returns Array combining selected options and search-matched options (deduplicated)
 */
export function getVisibleOptions(
  options: FacetOption[],
  selectedIds: Set<string>,
  searchTerm: string
): FacetOption[] {
  // Apply search filter to get options matching the query
  const searchFiltered = filterOptionsBySearch(options, searchTerm)

  // Fast path: if nothing is selected, return search results only
  if (selectedIds.size === 0) return searchFiltered

  // Extract currently selected options from full list (may not match search)
  const selectedOptions = options.filter((option) => selectedIds.has(option.id))

  // Merge selected + search-matched options without duplicates using Map
  // Map ensures unique keys; selected items go first to preserve their presence
  const combined = new Map<string, FacetOption>()

  // Add all selected options first (guaranteed to appear)
  for (const option of selectedOptions) {
    combined.set(option.id, option)
  }

  // Add search-matched options; Map automatically deduplicates any overlap
  for (const option of searchFiltered) {
    combined.set(option.id, option)
  }

  // Convert Map values back to array for rendering
  return Array.from(combined.values())
}
