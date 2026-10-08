'use client'

import { useIsomorphicEffect, usePrevious, useWindowEvent } from '@mantine/hooks'
import { useSearchParams } from 'next/navigation'
import { useCallback, useRef } from 'react'

import { dataAttribute } from '@/components/shared/utils/dom-utils'
import { pushQuery } from '@/components/shared/utils/url-utils'
import { OPEN_ID_ATTRIBUTE, useFocusReturn } from '@/hooks/use-focus-return'

import { OPEN_PROPOSAL_PARAM, type ProposalPage, proposalQuery } from '../model/selection-routes'

/** The attribute stamping a problem's id on its page's heading, which focus moves to as the problem opens. */
export const PROPOSAL_HEADING_ATTRIBUTE = dataAttribute('data-proposal-heading')

/**
 * The problem open in full over the pool, and the ways in and out of it.
 */
export type UseOpenProposalResult = {
  /** The problem open in full, by id; null while the pool shows. */
  openProposalId: string | null
  /** Opens a problem in full, on the tab asked for or else the first; the one already open stays as it is. */
  openProposal: (page: ProposalPage) => void
  /** Goes back to the pool; the pool already showing stays as it is. */
  closeProposal: () => void
}

/**
 * A problem's link in the pool as the problem was opened, and where it stood in the view. The pool comes back with
 * the link standing there, however the cards above it changed while the problem was open.
 */
type PoolAnchor = {
  /** The problem the link opens. */
  proposalId: string
  /** How far below the view's top the link stood, in pixels. */
  top: number
}

/**
 * Where the pool was left.
 */
type PoolSpot = {
  /** How far down the pool was scrolled, in pixels. */
  scrollY: number
  /** The link of the problem the pool was left for, until the pool next scrolls; null once it has. */
  anchor: PoolAnchor | null
}

/**
 * The problem the address names this instant, read off the address itself since a render can lag behind it.
 *
 * @returns The problem's id, or null while the address names none.
 */
function addressedProposalId(): string | null {
  // The problem the address's own query names, which a step in history reaches before any render does
  return new URLSearchParams(window.location.search).get(OPEN_PROPOSAL_PARAM)
}

/**
 * Where the pool stands this instant, kept by a problem's link where the pool shows one.
 *
 * @param proposalId - The problem whose link keeps the spot.
 *
 * @returns The spot.
 */
function poolSpotAt(proposalId: string): PoolSpot {
  // The problem's link, if the pool shows one
  const link = document.querySelector(OPEN_ID_ATTRIBUTE.selectorFor(proposalId))

  // The scroll, and where the link stands in the view
  return {
    scrollY: window.scrollY,
    anchor: link === null ? null : { proposalId, top: link.getBoundingClientRect().top },
  }
}

/**
 * How far down to scroll the pool to bring it back to a spot: with its anchor where it stood in the view, or at the
 * spot's own scroll where there is no anchor to go by.
 *
 * @param spot - Where the pool was left.
 *
 * @returns The scroll, in pixels from the top.
 */
function poolScrollFor({ scrollY, anchor }: PoolSpot): number {
  // No link to go by
  if (anchor === null) return scrollY

  // The link, where the pool still shows it
  const link = document.querySelector(OPEN_ID_ATTRIBUTE.selectorFor(anchor.proposalId))

  // Gone from the pool meanwhile, which leaves the scroll alone to go by
  if (link === null) return scrollY

  // The scroll putting the link back where it stood in the view
  return window.scrollY + link.getBoundingClientRect().top - anchor.top
}

/**
 * The problem open in full, carried in the address so a link to it can be shared. Moving in and out goes through
 * {@link pushQuery}, so the browser's back button steps between the problem and the pool. A problem starts at
 * the top with focus on its name, and the pool comes back where it was left with focus on the problem's link.
 *
 * @returns The open problem and the ways in and out of it.
 */
export function useOpenProposal(): UseOpenProposalResult {
  // The problem open in full
  const openProposalId = useSearchParams().get(OPEN_PROPOSAL_PARAM)

  // Where the pool was last left while it showed
  const poolSpotRef = useRef<PoolSpot>({ scrollY: 0, anchor: null })

  // Whether the page shows the pool, as of the last switch committed
  const isPoolPaintedRef = useRef(openProposalId === null)

  // The problem open on the previous render; undefined on the first
  const previousOpenId = usePrevious(openProposalId)

  // A function which puts focus back on the link of the problem last open
  const returnFocus = useFocusReturn(openProposalId)

  // Place whichever of a problem and the pool takes the screen before the switch is painted, and move focus onto it
  useIsomorphicEffect(() => {
    // What the page shows from this commit on
    isPoolPaintedRef.current = openProposalId === null

    // The first render is the browser's to place, which restores a reloaded page on its own, and a run
    // with nothing switched has nothing to move
    if (previousOpenId === undefined || previousOpenId === openProposalId) return

    // A problem opened
    if (openProposalId !== null) {
      // The problem from its top, jumped to since the page scrolls smoothly
      window.scrollTo({ top: 0, behavior: 'instant' })

      // Focus on the problem's name, which the reader's next Tab goes on from
      document
        .querySelector<HTMLElement>(PROPOSAL_HEADING_ATTRIBUTE.selectorFor(openProposalId))
        ?.focus({ preventScroll: true })
    }
    // The pool back
    else {
      // The pool where it was left, jumped to since the page scrolls smoothly
      window.scrollTo({ top: poolScrollFor(poolSpotRef.current), behavior: 'instant' })

      // Focus back on the link of the problem just closed
      returnFocus()
    }
  }, [openProposalId, previousOpenId, returnFocus])

  // The pool's spot, saved on every scroll of the pool so it stands ready however the pool is left. The scroll
  // a switch to a problem causes arrives after isPoolPaintedRef flips, so it is never saved as the pool's
  useWindowEvent('scroll', () => {
    // The pool's scroll with no link to go by, while the pool is what is painted
    if (isPoolPaintedRef.current) poolSpotRef.current = { scrollY: window.scrollY, anchor: null }
  })

  // A function which opens a problem
  const openProposal = useCallback((page: ProposalPage) => {
    // The asked-for problem open already, which another step in history would only repeat
    if (addressedProposalId() === page.proposalId) return

    // The pool's spot kept by the problem's link, while the pool is what is painted
    if (isPoolPaintedRef.current) poolSpotRef.current = poolSpotAt(page.proposalId)

    // The problem's address, as a new step in history
    pushQuery(proposalQuery(page))
  }, [])

  // A function which goes back to the pool
  const closeProposal = useCallback(() => {
    // The pool showing already, which another step in history would only repeat
    if (addressedProposalId() === null) return

    // The pool's address, as a new step in history
    pushQuery('')
  }, [])

  // The open problem and the ways in and out of it
  return { openProposalId, openProposal, closeProposal }
}
