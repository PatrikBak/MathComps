import { useCallback, useState } from 'react'

import {
  countActiveFilters,
  EMPTY_DEFENSE_REVIEW_FILTER,
  withFilterField,
} from '../model/defense-review-filters'
import type { DefenseReviewFilter } from '../model/defense-review-types'

/**
 * What {@link useDefenseReviewFilters} hands back.
 */
type UseDefenseReviewFiltersResult = {
  /** Which conversations the queue is showing. */
  filter: DefenseReviewFilter
  /** Replaces one field of the filter; passing undefined stops that field narrowing anything. */
  setField: <TField extends keyof DefenseReviewFilter>(
    field: TField,
    value: DefenseReviewFilter[TField]
  ) => void
  /** Returns the queue to showing everything. */
  clearAll: () => void
  /** How many fields are narrowing anything. */
  activeCount: number
}

/**
 * Holds which conversations the review queue is showing.
 *
 * The filter is held here and mirrored into the address by whoever owns the queue, rather than read out of the
 * address on every change: a narrowing has to show immediately, and a routed navigation lands a render later.
 *
 * @param initialFilter - What the address was already narrowed to when the queue opened.
 * @returns The filter as described by {@link UseDefenseReviewFiltersResult}.
 */
export function useDefenseReviewFilters(
  initialFilter: DefenseReviewFilter
): UseDefenseReviewFiltersResult {
  // What the queue is currently narrowed to
  const [filter, setFilter] = useState<DefenseReviewFilter>(initialFilter)

  // Replaces one field, against whatever the filter is when the change lands
  const setField = useCallback(
    <TField extends keyof DefenseReviewFilter>(field: TField, value: DefenseReviewFilter[TField]) =>
      setFilter((previous) => withFilterField(previous, field, value)),
    []
  )

  // Returns the queue to showing everything
  const clearAll = useCallback(() => setFilter(EMPTY_DEFENSE_REVIEW_FILTER), [])

  // The narrowing as it stands, the ways to change it, and how much of it there is
  return { filter, setField, clearAll, activeCount: countActiveFilters(filter) }
}
