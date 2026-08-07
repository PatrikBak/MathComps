import { assertNever } from '@/components/shared/utils/assert-never'
import { normalizeForSearch } from '@/components/shared/utils/string-utils'

import type { FacetGrouping, FacetOption, FacetSortMode, VisibleSection } from './facet-types'

/**
 * Names an option for assistive tech, folding in the result count so the figure shown
 * beside it is not lost.
 *
 * @param displayName - The option's visible name.
 * @param count - How many results it carries, when the facet shows counts.
 * @returns The option's accessible name.
 */
export function facetOptionAccessibleName(displayName: string, count: number | undefined): string {
  // No count, so the label is the whole name
  if (typeof count !== 'number') return displayName

  // The count trails the name
  return `${displayName} (${count})`
}

/**
 * Adds an option to a selection, or removes it when it is already there.
 *
 * @param optionId - The option being toggled.
 * @param selectedIds - The currently selected option ids.
 * @returns The resulting selection, as a new array.
 */
export function toggleOptionSelection(optionId: string, selectedIds: string[]): string[] {
  // Already selected, so the toggle removes it
  if (selectedIds.includes(optionId)) {
    return selectedIds.filter((id) => id !== optionId)
  }

  // Not selected yet, so the toggle appends it
  return [...selectedIds, optionId]
}

/**
 * Narrows options to those whose display name contains the search term, ignoring
 * both case and diacritics, so "cisla" finds "Čísla" and "STATISTIKA" finds "Štatistika".
 *
 * @param options - The options to narrow.
 * @param searchTerm - What the user typed; an empty term matches everything.
 * @returns The matching options, in their original order.
 */
export function filterOptionsBySearch<T extends FacetOption>(
  options: T[],
  searchTerm: string
): T[] {
  // An empty term filters nothing
  if (!searchTerm) return options

  // The term as it is compared: case-folded and stripped of diacritics
  const normalizedSearch = normalizeForSearch(searchTerm)

  // Keep the options whose normalized name contains the normalized term
  return options.filter((option) =>
    normalizeForSearch(option.displayName).includes(normalizedSearch)
  )
}

/**
 * Orders two options under a sort mode. Both count modes fall back to the display
 * name when the counts tie, so equal-count options stay in a stable, readable order.
 *
 * @param first - The option on the left of the comparison.
 * @param second - The option on the right of the comparison.
 * @param sortMode - The ordering to apply.
 * @param locale - Locale driving the display-name collation.
 * @returns A negative number, zero, or a positive number, as {@link Array.sort} expects.
 */
export function compareFacetOptions(
  first: FacetOption,
  second: FacetOption,
  sortMode: FacetSortMode,
  locale: string
): number {
  switch (sortMode) {
    // Purely by name
    case 'alpha':
      return first.displayName.localeCompare(second.displayName, locale)

    // By count, in whichever direction, with a name tiebreak
    case 'count-desc':
    case 'count-asc': {
      // The counts to compare, a missing one reading as zero
      const firstCount = first.count ?? 0
      const secondCount = second.count ?? 0

      // Equal counts carry no ordering information, so defer to the name
      if (firstCount === secondCount) {
        return first.displayName.localeCompare(second.displayName, locale)
      }

      // Counts differ, so the direction of the mode decides
      return sortMode === 'count-desc' ? secondCount - firstCount : firstCount - secondCount
    }

    // A mode outside the union, which the type system rules out
    default:
      return assertNever(sortMode)
  }
}

/**
 * Buckets options into their sections. Every requested key gets a bucket even when
 * nothing lands in it, so the section order is fixed; options
 * carrying an unknown or absent {@link FacetOption.groupKey} are dropped.
 *
 * @param options - The options to bucket.
 * @param keys - The section keys to bucket into.
 * @returns One bucket per requested key, each preserving the incoming order.
 */
export function groupOptionsByKey<T extends FacetOption>(
  options: T[],
  keys: string[]
): Record<string, T[]> {
  // Start every requested section empty
  const groups: Record<string, T[]> = Object.fromEntries(keys.map((key) => [key, []]))

  // Each option joins the section it names
  options.forEach((option) => {
    // Only a section that was asked for takes options
    if (option.groupKey && groups[option.groupKey]) {
      groups[option.groupKey].push(option)
    }
  })

  // Every requested key is present, whether or not anything landed in it
  return groups
}

/**
 * Puts a section's selected options first, each half ordered on its own so the
 * split survives the sort.
 *
 * @param sectionOptions - The options landing in one section.
 * @param sortMode - The ordering the section is under.
 * @param selectedIds - The currently selected option ids.
 * @param locale - Locale driving the display-name collation.
 * @returns The section's options, selected ones leading.
 */
function selectedFirst<T extends FacetOption>(
  sectionOptions: T[],
  sortMode: FacetSortMode,
  selectedIds: string[],
  locale: string
): T[] {
  // A function which orders two options under this section's mode
  const compare = (first: T, second: T) => compareFacetOptions(first, second, sortMode, locale)

  // The selected half ahead of the rest
  return [
    // The selected options, under the section's ordering
    ...sectionOptions.filter((option) => selectedIds.includes(option.id)).sort(compare),

    // Then everything else, under the same ordering
    ...sectionOptions.filter((option) => !selectedIds.includes(option.id)).sort(compare),
  ]
}

/**
 * Orders a flat facet's options so the selected ones lead. Unselected options hold
 * the order they arrived in.
 *
 * @param options - The options to order.
 * @param selectedIds - The currently selected option ids.
 * @returns The options reordered, as a new array.
 */
export function orderFlatOptions<T extends FacetOption>(options: T[], selectedIds: string[]): T[] {
  // A copy with the selected options moved to the front
  return [...options].sort((first, second) => {
    // Selection is the only thing this comparison looks at
    const firstSelected = selectedIds.includes(first.id)
    const secondSelected = selectedIds.includes(second.id)

    // Two of a kind carry no ordering, which leaves their incoming order intact
    if (firstSelected === secondSelected) return 0

    // Otherwise the selected one leads
    return firstSelected ? -1 : 1
  })
}

/**
 * Orders a grouped facet's options section by section, each section under its own
 * sort mode with its selected options leading. Sections follow the configured key
 * order, and options belonging to no configured section are dropped.
 *
 * @param options - The options to order.
 * @param grouping - The sections to arrange them into.
 * @param sortModes - The ordering each section is under, keyed by section.
 * @param selectedIds - The currently selected option ids.
 * @param locale - Locale driving the display-name collation.
 * @returns Every section's options concatenated in the configured key order.
 */
export function orderGroupedOptions<T extends FacetOption>(
  options: T[],
  grouping: FacetGrouping,
  sortModes: Record<string, FacetSortMode>,
  selectedIds: string[],
  locale: string
): T[] {
  // The options split into their sections
  const bucketed = groupOptionsByKey(options, grouping.keys)

  // Every section's options, in the configured key order
  return grouping.keys.flatMap((groupKey) =>
    selectedFirst(bucketed[groupKey], sortModes[groupKey], selectedIds, locale)
  )
}

/**
 * Splits already-ordered options back into the sections a grouped facet renders,
 * dropping any section nothing landed in.
 *
 * @param options - The options to split, in the order they should render.
 * @param grouping - The sections to split them into.
 * @returns One entry per section that still has something to show, in the configured key order.
 */
export function toVisibleSections<T extends FacetOption>(
  options: T[],
  grouping: FacetGrouping
): VisibleSection<T>[] {
  // The options split back into their sections
  const bucketed = groupOptionsByKey(options, grouping.keys)

  // In the configured order, minus the empty sections
  return grouping.keys
    .map((groupKey) => ({ groupKey, sectionOptions: bucketed[groupKey] }))
    .filter(({ sectionOptions }) => sectionOptions.length > 0)
}
