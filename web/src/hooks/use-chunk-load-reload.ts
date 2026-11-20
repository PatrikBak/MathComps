'use client'

import { useEffect, useState } from 'react'

import { recordChunkLoadReload, shouldReloadFor } from '@/components/shared/utils/chunk-load-reload'

/**
 * Reloads the page once over a chunk that failed to load, as {@link shouldReloadFor} decides. The reloaded
 * page comes from the deployment serving now, so a page kept open past a deploy recovers on its own.
 *
 * @param error - The fault the page hit.
 *
 * @returns Whether the page is reloading itself over the fault.
 */
export function useChunkLoadReload(error: unknown): boolean {
  // Whether the page reloads, decided once as the fault arrives, so recording the reload never undoes it
  const [isReloading, setIsReloading] = useState(() => shouldReloadFor(error))

  // The reload, recorded first so the reloaded page can tell it was one
  useEffect(() => {
    // A page that stays has nothing to do
    if (!isReloading) return

    // The reload, once the tab has recorded it
    if (recordChunkLoadReload()) {
      // A fresh copy of the page
      window.location.reload()
    } else {
      // A tab whose storage refuses the record could reload forever, so it shows the fault instead
      setIsReloading(false)
    }
  }, [isReloading])

  // Whether the reload is on its way
  return isReloading
}
