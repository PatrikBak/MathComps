'use client'

import { useWindowEvent } from '@mantine/hooks'
import { useCallback, useMemo, useState } from 'react'

import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'

import {
  fromPoolFilterQuery,
  POOL_FILTER_PARAMS,
  type PoolPicks,
  toPoolFilterQuery,
  withAddressed,
  withPickedFilter,
} from '../model/pool-filter-url'
import { OPEN_POOL_FILTER, type PoolFilter, withListedCategories } from '../model/pool-filters'
import type { SelectionCategory } from '../model/selection-types'

/**
 * Return type for {@link usePoolFilters}.
 */
export type UsePoolFiltersResult = {
  /** What the pool is narrowed to. */
  filter: PoolFilter
  /** Replaces one field of the filter. */
  setField: <TField extends keyof PoolFilter>(field: TField, value: PoolFilter[TField]) => void
  /** Opens every filter back up. */
  clearAll: () => void
}

/**
 * Holds what the pool is narrowed to, one filter across every layout of the pool. All of it but a State answer on or
 * off the board is carried in the address beside the problem open over the pool, so a reload or a shared link comes
 * back to the same pool, and a step back or forward through history takes the pool to the filter that step's address
 * holds, while the pool is hidden behind a problem as well. A State answer on or off the board follows the board on
 * screen, so it lasts until a reload, through every step in history, and comes back once a step leaves an address
 * naming a whole paper. Once the selection arrives, a category it doesn't list narrows nothing and leaves the address.
 *
 * @param categories - The selection's categories; null until its read lands.
 *
 * @returns The filter, and the ways to change it.
 */
export function usePoolFilters(
  categories: readonly SelectionCategory[] | null
): UsePoolFiltersResult {
  // What the address narrowed the pool to when the page opened
  const addressedFilter = useInitialUrlState(fromPoolFilterQuery)

  // What the pool is narrowed to as picked, the address's filter at first, whatever categories it names, with no answer
  // on or off the board picked yet
  const [picks, setPicks] = useState<PoolPicks>({ filter: addressedFilter, boardPick: null })

  // What the pool is narrowed to: the filter as picked, once the selection arrives with only the categories it lists
  const filter = useMemo(
    () => (categories === null ? picks.filter : withListedCategories(picks.filter, categories)),
    [picks.filter, categories]
  )

  // The address carrying the filter as far as it can, every other parameter left as it stands
  useAddressSync(toPoolFilterQuery(filter), POOL_FILTER_PARAMS)

  // A function which takes the pool to the filter the address holds, with the answer on or off the board picked last
  // where the address names none
  const followAddress = useCallback(
    () =>
      setPicks((previous) =>
        withAddressed(previous, fromPoolFilterQuery(new URLSearchParams(window.location.search)))
      ),
    []
  )

  // The address's filter after every step back or forward through history
  useWindowEvent('popstate', followAddress)

  // A function which replaces one field, against whatever the filter is when the change lands
  const setField = useCallback(
    <TField extends keyof PoolFilter>(field: TField, value: PoolFilter[TField]) =>
      setPicks((previous) => withPickedFilter(previous, { ...previous.filter, [field]: value })),
    []
  )

  // A function which opens every filter back up
  const clearAll = useCallback(
    () => setPicks((previous) => withPickedFilter(previous, OPEN_POOL_FILTER)),
    []
  )

  // The filter and the ways to change it, held steady while the filter stands
  return useMemo(() => ({ filter, setField, clearAll }), [filter, setField, clearAll])
}
