'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'

import type { GuidePage } from '../content/guide-content-types'
import { useGuideDeck } from './guide-deck-context'

/**
 * Props for the {@link DeckLink} component.
 */
type DeckLinkProps = {
  /** The deck page to slide to on click. */
  page: GuidePage
  /** The link text. */
  children: ReactNode
}

/**
 * An inline link that slides the deck to another page via the deck's {@link useGuideDeck} navigation.
 */
export function DeckLink({ page, children }: DeckLinkProps) {
  // Grab the deck's page navigation
  const { goToPage } = useGuideDeck()

  // A text link that switches the active deck page; underline keeps the rest-state underline
  return (
    <Button variant="link" className="underline" onClick={() => goToPage(page)}>
      {children}
    </Button>
  )
}
