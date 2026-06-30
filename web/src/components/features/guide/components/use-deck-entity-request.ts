import { useCallback, useState } from 'react'

import type { GuidePage } from '../content/guide-content-types'

/**
 * The deck's pending deep-link reveal request and the controls that drive it.
 */
export type DeckEntityRequest = {
  /** The id of the entity a reveal was requested for, or null. */
  openEntityId: string | null
  /** Navigate to a page and request that its entity be revealed there. */
  requestOpenEntity: (page: GuidePage, entityId: string) => void
  /** Drop a pending reveal request once consumed. */
  clearOpenEntity: () => void
}

/**
 * A hook that holds a pending "reveal this entity" request raised from outside the deck (an inline link
 * or the search palette): it navigates to the entity's page, then flags the id for the matching card to
 * consume. The card clears the request once handled.
 *
 * @param goToPage - Steps the deck to a page by name.
 *
 * @returns The pending entity id and the request + clear controls.
 */
export function useDeckEntityRequest(goToPage: (page: GuidePage) => void): DeckEntityRequest {
  // The id of the entity a reveal was requested for, or null
  const [openEntityId, setOpenEntityId] = useState<string | null>(null)

  // Jump to a page and request that one of its entities is revealed there
  const requestOpenEntity = useCallback(
    (page: GuidePage, entityId: string) => {
      // Switch to the page
      goToPage(page)
      // Flag the entity for its card to reveal
      setOpenEntityId(entityId)
    },
    [goToPage]
  )

  // Drop any pending reveal request
  const clearOpenEntity = useCallback(() => setOpenEntityId(null), [])

  // Hand back the pending id and its controls
  return { openEntityId, requestOpenEntity, clearOpenEntity }
}
