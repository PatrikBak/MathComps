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

/** What trails a facet's name on a trigger narrowed to an option the facet cannot yet name. */
const UNNAMED_SELECTION_SUFFIX = ' …'

/**
 * Names the one option a facet stands narrowed to, for a trigger that carries the selection in its own
 * text rather than a count beside a heading. An option whose label leans on what its list puts around it
 * is named in full here, since the trigger stands on its own.
 *
 * An option the facet has no entry for still gets an answer, since a facet whose options are still on
 * their way would otherwise read exactly like one nothing is selected in.
 *
 * @param selectedIds - The ids currently selected.
 * @param options - The options the facet can offer, which it may not have yet.
 * @param title - Name of what the facet filters by, which stands in for an option it cannot name.
 * @returns The name to show, or null where the trigger should speak for the facet rather than the selection.
 */
export function soleSelectionLabel(
  selectedIds: string[],
  options: FacetOption[],
  title: string
): string | null {
  // Only a single selection has a name to carry: nothing and several are both told by the count instead
  if (selectedIds.length !== 1) return null

  // The option standing, which a facet still waiting on its options doesn't hold
  const selectedOption = options.find((option) => option.id === selectedIds[0])

  // Named where the facet knows it, and otherwise read as a narrowing whose name has not arrived
  if (selectedOption === undefined) return `${title}${UNNAMED_SELECTION_SUFFIX}`

  // The fuller name where there is one, since nothing beside the trigger fills in what the label leaves out
  return selectedOption.fullName ?? selectedOption.displayName
}

/**
 * Narrows options to those whose name contains the search term, ignoring both case and diacritics, so
 * "cisla" finds "Čísla" and "STATISTIKA" finds "Štatistika". An option carrying a fuller name than its
 * label is searched by both, so what the label leaves out still finds it.
 *
 * @param options - The options to narrow.
 * @param searchTerm - What the user typed; a term of nothing but whitespace matches everything.
 * @returns The matching options, in their original order.
 */
export function filterOptionsBySearch<T extends FacetOption>(
  options: T[],
  searchTerm: string
): T[] {
  // The term as it is compared: trimmed, case-folded and stripped of diacritics
  const normalizedSearch = normalizeForSearch(searchTerm.trim())

  // An empty term filters nothing
  if (!normalizedSearch) return options

  // Keep the options either of whose normalized names contains the normalized term
  return options.filter(
    (option) =>
      normalizeForSearch(option.displayName).includes(normalizedSearch) ||
      (option.fullName !== undefined &&
        normalizeForSearch(option.fullName).includes(normalizedSearch))
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

/** How many options a section has to hold before reordering it can tell the user anything. */
const SORT_MIN_SECTION_OPTIONS = 5

/**
 * Whether a grouped facet's sections should each offer a control over their ordering.
 *
 * @param options - The options the sections are filled from.
 * @param grouping - The sections they are split into.
 * @returns Whether ordering is worth a control on the section headings.
 */
export function sectionsWorthSorting(options: FacetOption[], grouping: FacetGrouping): boolean {
  // The options split into their sections
  const bucketed = groupOptionsByKey(options, grouping.keys)

  // One long section decides it for the facet, since a control appearing on some headings and not others
  // reads as the headings disagreeing about what they are
  return grouping.keys.some((groupKey) => bucketed[groupKey].length >= SORT_MIN_SECTION_OPTIONS)
}

/**
 * Puts a section's leading options first, each half ordered on its own so the
 * split survives the sort.
 *
 * @param sectionOptions - The options landing in one section.
 * @param sortMode - The ordering the section is under.
 * @param leadingIds - Ids of the options to float to the top of the section.
 * @param locale - Locale driving the display-name collation.
 * @returns The section's options, the named ones leading.
 */
function orderSection<T extends FacetOption>(
  sectionOptions: T[],
  sortMode: FacetSortMode,
  leadingIds: string[],
  locale: string
): T[] {
  // A function which orders two options under this section's mode
  const compare = (first: T, second: T) => compareFacetOptions(first, second, sortMode, locale)

  // The leading half ahead of the rest
  return [
    // The options named, under the section's ordering
    ...sectionOptions.filter((option) => leadingIds.includes(option.id)).sort(compare),

    // Then everything else, under the same ordering
    ...sectionOptions.filter((option) => !leadingIds.includes(option.id)).sort(compare),
  ]
}

/**
 * Orders a flat facet's options so the named ones lead. The rest hold the order
 * they arrived in.
 *
 * @param options - The options to order.
 * @param leadingIds - Ids of the options to float to the top.
 * @returns The options reordered, as a new array.
 */
export function orderFlatOptions<T extends FacetOption>(options: T[], leadingIds: string[]): T[] {
  // A copy with the named options moved to the front
  return [...options].sort((first, second) => {
    // Leading or not is the only thing this comparison looks at
    const firstLeads = leadingIds.includes(first.id)
    const secondLeads = leadingIds.includes(second.id)

    // Two of a kind carry no ordering, which leaves their incoming order intact
    if (firstLeads === secondLeads) return 0

    // Otherwise the named one goes first
    return firstLeads ? -1 : 1
  })
}

/**
 * Orders a grouped facet's options section by section, each section under its own
 * sort mode with the named options leading it. Sections follow the configured key
 * order, and options belonging to no configured section are dropped.
 *
 * @param options - The options to order.
 * @param grouping - The sections to arrange them into.
 * @param sortModes - The ordering each section is under, keyed by section.
 * @param leadingIds - Ids of the options to float to the top of their section.
 * @param locale - Locale driving the display-name collation.
 * @returns Every section's options concatenated in the configured key order.
 */
export function orderGroupedOptions<T extends FacetOption>(
  options: T[],
  grouping: FacetGrouping,
  sortModes: Record<string, FacetSortMode>,
  leadingIds: string[],
  locale: string
): T[] {
  // The options split into their sections
  const bucketed = groupOptionsByKey(options, grouping.keys)

  // Every section's options, in the configured key order
  return grouping.keys.flatMap((groupKey) =>
    orderSection(bucketed[groupKey], sortModes[groupKey], leadingIds, locale)
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

/** The keys an option list walks itself, rather than leaving them to the browser. */
const FACET_NAVIGATION_KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'] as const

/** One of the keys walking a facet's option list. */
export type FacetNavigationKey = (typeof FACET_NAVIGATION_KEYS)[number]

/** How many parts the list is split into, one of which a page key jumps over. */
const PAGE_FRACTION = 10

/**
 * Whether a pressed key is one an option list walks itself.
 *
 * @param key - The key pressed.
 * @returns Whether the list takes the key over.
 */
export function isFacetNavigationKey(key: string): key is FacetNavigationKey {
  // Read as plain strings, since the key being compared is not known to be one of them yet
  return (FACET_NAVIGATION_KEYS as readonly string[]).includes(key)
}

/**
 * Answers which option a navigation key moves focus to.
 *
 * Focus can sit inside the list without sitting on an option, since a section's heading and its ordering
 * button stand among the options and their keypresses arrive here too. From there a key enters the list at
 * the end it is travelling from rather than walking off an option it isn't on: down enters at the first
 * option, up at the last, the way a closed combobox opens.
 *
 * @param key - The key pressed.
 * @param focusedIndex - Which option currently holds focus, or -1 when focus sits on none of them.
 * @param optionCount - How many options the list holds, of which there is at least one.
 * @returns The option focus lands on.
 */
export function nextFocusedOptionIndex(
  key: FacetNavigationKey,
  focusedIndex: number,
  optionCount: number
): number {
  // The far end of the list, which the downward keys clamp to
  const lastIndex = optionCount - 1

  // Whether focus is on none of the options, in which case a key enters the list instead of walking it
  const isOutside = focusedIndex === -1

  // How far a page key travels, never less than a single option
  const page = Math.max(1, Math.floor(optionCount / PAGE_FRACTION))

  switch (key) {
    // One option down, stopping at the last
    case 'ArrowDown':
      return isOutside ? 0 : Math.min(lastIndex, focusedIndex + 1)

    // One option up, stopping at the first
    case 'ArrowUp':
      return isOutside ? lastIndex : Math.max(0, focusedIndex - 1)

    // Straight to the top of the list
    case 'Home':
      return 0

    // Straight to the bottom of it
    case 'End':
      return lastIndex

    // A page further down, no further than the last option
    case 'PageDown':
      return isOutside ? 0 : Math.min(lastIndex, focusedIndex + page)

    // A page further up, no further than the first option
    case 'PageUp':
      return isOutside ? lastIndex : Math.max(0, focusedIndex - page)

    // A key outside the union, which the type system rules out
    default:
      return assertNever(key)
  }
}
