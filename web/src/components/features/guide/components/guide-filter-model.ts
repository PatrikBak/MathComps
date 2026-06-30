/**
 * A single selectable filter value within a group.
 */
type FilterOption = {
  /** Canonical value (null represents the "all" option). */
  value: string | null
  /** Localized label. */
  label: string
}

/**
 * A concrete value/label pair for one filter dimension.
 */
export type FilterValueOption<TValue extends string> = {
  /** Canonical value for this option. */
  value: TValue
  /** Localized label. */
  label: string
}

/**
 * One filter dimension (e.g. level, kind, country, bucket) with its options.
 */
export type FilterPillGroup = {
  /** Stable key for the dimension. */
  key: string
  /** Localized dimension label. */
  label: string
  /** Selectable options, including the leading "all" option. */
  options: FilterOption[]
  /** The currently selected value, or null for "all". */
  selected: string | null
  /** Called with the chosen value (null clears the dimension). */
  onSelect: (value: string | null) => void
}

/**
 * Assembles a single filter dimension, prepending the "all" reset option.
 *
 * @param key - Stable dimension key.
 * @param label - Localized dimension label.
 * @param allLabel - Localized label for the leading "all" option.
 * @param options - The concrete value/label pairs.
 * @param selected - The currently selected value, or null.
 * @param onSelect - Selection handler.
 *
 * @returns The assembled group.
 */
export function makeFilterGroup<TValue extends string>(
  key: string,
  label: string,
  allLabel: string,
  options: FilterValueOption<TValue>[],
  selected: TValue | null,
  onSelect: (value: TValue | null) => void
): FilterPillGroup {
  // Assemble the group, widening onSelect back to the dimension's value type
  return {
    key,
    label,
    selected,
    // The pill loop only knows `string | null`; re-widen here since each value came from this
    // dimension's own options, so the cast is sound and lives here instead of at every call site
    onSelect: (value) => onSelect(value as TValue | null),
    // Prepend the "all" reset before the concrete options
    options: [{ value: null, label: allLabel }, ...options],
  }
}

/**
 * One active (non-"all") selection, ready to render as a removable summary chip.
 */
export type ActiveSelection = {
  /** The dimension's stable key. */
  key: string
  /** The selected option's localized label. */
  label: string
  /** Clears this dimension back to "all". */
  onClear: () => void
}

/**
 * Picks out the dimensions that have a concrete selection, pairing each with its chosen option's
 * label and a clear action — the data the collapsed filter bar shows as removable chips.
 *
 * @param groups - The filter dimensions to scan.
 *
 * @returns One entry per dimension with an active (non-"all") selection.
 */
export function getActiveSelections(groups: FilterPillGroup[]): ActiveSelection[] {
  // One chip per dimension that's narrowed away from "all" and still maps to a known option
  return groups.flatMap((group) => {
    // "All" means no chip for this dimension
    if (group.selected === null) return []
    // The selected option, if this page actually offers it
    const option = group.options.find((candidate) => candidate.value === group.selected)
    // A stale or foreign URL value resolves to no option — drop it rather than show a blank chip
    if (option === undefined) return []
    // The chip: the selected option's label plus a clear-this-dimension action
    return [{ key: group.key, label: option.label, onClear: () => group.onSelect(null) }]
  })
}
