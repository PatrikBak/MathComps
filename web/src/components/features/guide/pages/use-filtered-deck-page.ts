import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'

import {
  type FilterPillGroup,
  type FilterValueOption,
  makeFilterGroup,
} from '../components/guide-filter-model'
import { EMPTY_FILTERS, type GuideFilters } from '../content/guide-filters'

/**
 * Pairs each facet value with its localized label, ready to feed a filter dimension. Lets a page
 * declare a dimension's options in one call.
 *
 * @param values - The facet values present on the page, in canonical order.
 * @param labels - Localized labels keyed by facet value.
 *
 * @returns One value/label option per facet value, in the given order.
 */
export function toOptions<TValue extends string>(
  values: readonly TValue[],
  labels: Record<TValue, string>
): FilterValueOption<TValue>[] {
  // Zip each value with its label
  return values.map((value) => ({ value, label: labels[value] }))
}

/**
 * One filter dimension as a page declares it: which {@link GuideFilters} key it drives, its localized
 * row label, and the value/label options (the leading "all" reset is added by the hook).
 */
type FilterDimension<Key extends keyof GuideFilters> = {
  /** The single-select filter key this dimension drives. */
  key: Key
  /** Localized dimension (row) label. */
  label: string
  /** The selectable value/label options, excluding the leading "all". */
  options: FilterValueOption<NonNullable<GuideFilters[Key]>>[]
}

/**
 * Any filter dimension, whichever key it drives — the element type of the dimension list a page hands
 * {@link useFilteredDeckPage}. Distributing over the keys keeps each dimension's key and option type
 * correlated, so a `kind` dimension can only carry kind options.
 */
export type AnyFilterDimension = {
  [Key in keyof GuideFilters]: FilterDimension<Key>
}[keyof GuideFilters]

/**
 * The assembled state a filterable deck page renders.
 */
type FilteredDeckPageState<Entity> = {
  /** The filter dimensions, each wired to the active selection and "all"-prepended. */
  groups: FilterPillGroup[]
  /** The entities passing every active filter, in display order. */
  matching: Entity[]
  /** Clears every filter back to "all". */
  reset: () => void
}

/**
 * The inputs a filterable deck page hands {@link useFilteredDeckPage}.
 */
type FilteredDeckPageConfig<Entity> = {
  /** The page's full entity list, in display order. */
  content: readonly Entity[]
  /** Predicate testing one entity against the active filters. */
  matches: (entity: Entity, filters: GuideFilters) => boolean
  /** The page's filter dimensions, in display order (memoize at the call site). */
  dimensions: readonly AnyFilterDimension[]
  /** The page's current single-select selection. */
  filters: GuideFilters
  /** Updates the page's selection. */
  onFiltersChange: (filters: GuideFilters) => void
  /** Orders the matching entities; omit to keep the content order. */
  sort?: (first: Entity, second: Entity) => number
}

/**
 * Drives a single-select filterable deck page: wires each declared dimension to the page's filter state
 * (prepending the shared "all" reset), filters the content to the active selection (optionally sorted),
 * and memoizes the result. The memoization matters because every deck page stays mounted in the pager,
 * so without it an off-screen page would re-filter on every unrelated deck re-render.
 *
 * @returns The wired groups, the matching entities, and the reset action.
 */
export function useFilteredDeckPage<Entity>({
  content,
  matches,
  dimensions,
  filters,
  onFiltersChange,
  sort,
}: FilteredDeckPageConfig<Entity>): FilteredDeckPageState<Entity> {
  // Grab the deck filter translations
  const tDeck = useTranslations('guide.deck')
  // The "all" reset label, shared across every dimension on the page
  const allLabel = tDeck('filters.all')

  // Wire each dimension to the live selection, prepending the shared "all" option. The per-dimension
  // key/value correlation is sound by construction, so the group is built at the loose `string` width
  // makeFilterGroup exposes and the one cast lives here, not at every call site.
  const groups = useMemo(
    () =>
      dimensions.map((dimension) =>
        makeFilterGroup<string>(
          dimension.key,
          dimension.label,
          allLabel,
          dimension.options,
          filters[dimension.key],
          (value) => onFiltersChange({ ...filters, [dimension.key]: value } as GuideFilters)
        )
      ),
    [dimensions, allLabel, filters, onFiltersChange]
  )

  // The entities surviving the active filters, in display order (sorted when a comparator is given)
  const matching = useMemo(() => {
    // Keep only those passing every active filter
    const kept = content.filter((entity) => matches(entity, filters))
    // Order them when the page supplies a comparator, else keep the content order
    return sort ? [...kept].sort(sort) : kept
  }, [content, matches, filters, sort])

  // Clear every dimension back to "all"
  const reset = useCallback(() => onFiltersChange(EMPTY_FILTERS), [onFiltersChange])

  // Hand back the wired groups, the survivors, and the reset
  return { groups, matching, reset }
}
