'use client'

import { useSearchParams } from 'next/navigation'

import { parseMember } from '@/components/shared/utils/collection-utils'
import { mergeOwnedParams, replaceQuery } from '@/components/shared/utils/url-utils'

import { POOL_VIEW_PARAM, POOL_VIEWS, type PoolViewMode } from '../model/selection-routes'

/**
 * What {@link usePoolViewMode} hands back.
 */
type UsePoolViewModeResult = {
  /** How the pool is laid out. */
  mode: PoolViewMode
  /** Lays the pool out another way. */
  showMode: (mode: PoolViewMode) => void
}

/**
 * How the pool is laid out, carried in the address so a reload or a link opens on it too. Changing it leaves every
 * other parameter of the address as it stands.
 *
 * @returns The layout and the way to change it.
 */
export function usePoolViewMode(): UsePoolViewModeResult {
  // The layout the address names, the first one when it names none the pool has
  const mode = parseMember(useSearchParams().get(POOL_VIEW_PARAM), POOL_VIEWS) ?? POOL_VIEWS[0]

  // A function which lays the pool out another way
  const showMode = (next: PoolViewMode) =>
    replaceQuery(mergeOwnedParams(`${POOL_VIEW_PARAM}=${next}`, [POOL_VIEW_PARAM]))

  // The layout and the way to change it
  return { mode, showMode }
}
