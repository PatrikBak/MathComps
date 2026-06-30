'use client'

import { createContext, type ReactNode, use } from 'react'

import type { GuidePage } from '../content/guide-content-types'

/**
 * Cross-component deck controls, letting guide UI outside the deck drive it.
 */
export type GuideDeckContextValue = {
  /** Navigate the deck to a page. */
  goToPage: (page: GuidePage) => void
  /** Navigate to a page and request that its entity be revealed there (and its modal opened, if any). */
  requestOpenEntity: (page: GuidePage, entityId: string) => void
  /** The id of the entity a reveal was requested for, or null. */
  openEntityId: string | null
  /** Clear the reveal request once consumed. */
  clearOpenEntity: () => void
  /** Mark a card modal as open; returns a deregister to call when it closes. */
  registerOpenModal: () => () => void
  /** The live pixel height of the deck's sticky tab bar; it grows as the row wraps. */
  stickyTabBarHeight: number
  /** Pre-rendered rich descriptions, keyed by description slot (an entity's main blurb or a detail bullet). */
  richDescriptions: Record<string, ReactNode>
}

/** Context carrying the deck controls; null outside its provider. */
export const GuideDeckContext = createContext<GuideDeckContextValue | null>(null)

/**
 * Reads the deck controls from context.
 *
 * @returns The deck controls.
 */
export function useGuideDeck(): GuideDeckContextValue {
  // Pull the context value
  const value = use(GuideDeckContext)
  // Guard against use outside the provider
  if (!value) throw new Error('useGuideDeck must be used within a GuideDeckContext provider')
  // Hand back the controls
  return value
}
