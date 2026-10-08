'use client'

import { useWindowEvent } from '@mantine/hooks'
import { useCallback, useMemo, useState } from 'react'

import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'

import {
  fromPoolFilterQuery,
  POOL_FILTER_PARAMS,
  toPoolFilterQuery,
} from '../model/pool-filter-url'
import { countActiveFilters, OPEN_POOL_FILTER, type PoolFilter } from '../model/pool-filters'

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
  /** How many fields are narrowing anything. */
  activeCount: number
}

/**
 * Holds what the pool is narrowed to. All of it but {@link PoolFilter.isOffBoardOnly} is carried in the address
 * beside the problem open over the pool, so a reload or a shared link comes back to the same pool, and a step back
 * or forward through history takes the pool to the filter that step's address holds, while the pool is hidden
 * behind a problem as well. {@link PoolFilter.isOffBoardOnly} lasts until a reload, through every step in history.
 *
 * @returns The filter, the ways to change it, and how much of it narrows.
 */
export function usePoolFilters(): UsePoolFiltersResult {
  // What the address narrowed the pool to when the page opened
  const addressedFilter = useInitialUrlState(fromPoolFilterQuery)

  // What the pool is narrowed to, the address's filter at first
  const [filter, setFilter] = useState<PoolFilter>({ ...OPEN_POOL_FILTER, ...addressedFilter })

  // The address carrying the filter as far as it can, every other parameter left as it stands
  useAddressSync(toPoolFilterQuery(filter), POOL_FILTER_PARAMS)

  // A function which takes the pool to the filter the address holds, keeping whether the board's own problems
  // are left out
  const followAddress = useCallback(
    () =>
      setFilter((previous) => ({
        ...previous,
        ...fromPoolFilterQuery(new URLSearchParams(window.location.search)),
      })),
    []
  )

  // The address's filter after every step back or forward through history
  useWindowEvent('popstate', followAddress)

  // A function which replaces one field, against whatever the filter is when the change lands
  const setField = useCallback(
    <TField extends keyof PoolFilter>(field: TField, value: PoolFilter[TField]) =>
      setFilter((previous) => ({ ...previous, [field]: value })),
    []
  )

  // A function which opens every filter back up
  const clearAll = useCallback(() => setFilter(OPEN_POOL_FILTER), [])

  // The filter, the ways to change it, and how much of it narrows, held steady while the filter stands
  return useMemo(
    () => ({ filter, setField, clearAll, activeCount: countActiveFilters(filter) }),
    [filter, setField, clearAll]
  )
}
