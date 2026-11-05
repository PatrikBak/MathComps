'use client'

import { useWindowEvent } from '@mantine/hooks'
import { useCallback, useMemo, useState } from 'react'

import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'

import {
  POOL_VIEW_PARAMS,
  type PoolViewMode,
  poolViewOf,
  poolViewQuery,
} from '../model/selection-routes'

/**
 * What {@link usePoolViewMode} hands back.
 */
export type UsePoolViewModeResult = {
  /** How the pool is laid out. */
  mode: PoolViewMode
  /** Lays the pool out another way. */
  showMode: (mode: PoolViewMode) => void
}

/**
 * How the pool is laid out, carried in the address so a reload or a link opens on it too. A step back or forward
 * through history takes the pool to the layout that step's address holds, while the pool is hidden behind a page as
 * well. Changing it leaves every other parameter of the address as it stands.
 *
 * @returns The layout and the way to change it.
 */
export function usePoolViewMode(): UsePoolViewModeResult {
  // How the address laid the pool out when the page opened
  const addressedMode = useInitialUrlState(poolViewOf)

  // How the pool is laid out, the address's layout at first
  const [mode, setMode] = useState(addressedMode)

  // The address carrying the layout, every other parameter left as it stands
  useAddressSync(poolViewQuery(mode), POOL_VIEW_PARAMS)

  // A function which takes the pool to the layout the address holds
  const followAddress = useCallback(
    () => setMode(poolViewOf(new URLSearchParams(window.location.search))),
    []
  )

  // The address's layout after every step back or forward through history
  useWindowEvent('popstate', followAddress)

  // The layout and the way to change it, held steady while the layout stands
  return useMemo(() => ({ mode, showMode: setMode }), [mode])
}
