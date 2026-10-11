'use client'

import { useIsomorphicEffect, usePrevious, useWindowEvent } from '@mantine/hooks'
import { useSearchParams } from 'next/navigation'
import { type RefObject, useCallback, useMemo, useRef } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'
import { dataAttribute, focusShown, shownElement } from '@/components/shared/utils/dom-utils'
import { mergeOwnedParams, pushQuery, replaceQuery } from '@/components/shared/utils/url-utils'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'

import {
  DETAIL_PARAMS,
  detailOf,
  type DetailPage,
  detailQuery,
  type OpenDetail,
  PAGE_PARAMS,
  PAPER_TABS,
  paperBeneathOf,
  type PaperTab,
  tabOf,
} from '../model/selection-routes'

/** The attribute stamping a page's subject id on the page's heading, which focus moves to as the page opens. */
export const DETAIL_HEADING_ATTRIBUTE = dataAttribute('data-detail-heading')

/**
 * The page open in full over the pool, a problem's or a paper's, and the ways in and out of it.
 */
export type UseOpenDetailResult = {
  /** The page open in full; null while the pool shows. */
  detail: OpenDetail | null
  /** The paper the open problem was opened over; null while no problem is open over one. */
  paperBeneathId: string | null
  /**
   * Opens a page in full, on the tab asked for or else the first; the one already open stays as it is. A problem
   * opened from a paper's page, or from a problem opened over one, opens over that paper. The paper beneath the
   * problem on screen, opened with no tab asked for, comes back on the tab it was left on.
   */
  openDetail: (page: DetailPage) => void
  /** Goes back to the pool; the pool already showing stays as it is. */
  closeDetail: () => void
  /**
   * Leaves a page whose subject is gone for the paper it was opened over, or else the pool, leaving no step behind
   * that leads back to the gone page.
   */
  leaveDetail: () => void
  /** The pool's line counting its problems. */
  poolCountRef: RefObject<HTMLParagraphElement | null>
}

/**
 * A link to a page as the page was opened, and where it stood in the view. The pool or the paper's page comes back
 * with the link standing where it stood, however what sat above it changed while the page was open.
 */
type LinkAnchor = {
  /** The subject of the page the link opens. */
  id: string
  /** How far below the view's top the link stood, in pixels. */
  top: number
}

/**
 * Where the pool or a paper's page was left.
 */
type LeftSpot = {
  /** How far down the screen was scrolled, in pixels. */
  scrollY: number
  /** The link of the page it was left for; null where the scroll alone keeps the spot. */
  anchor: LinkAnchor | null
}

/**
 * Where a paper's page was left.
 */
type PaperSpot = {
  /** The paper. */
  paperId: string
  /** The tab it was on. */
  tab: PaperTab
  /** Where on that tab. */
  spot: LeftSpot
}

/**
 * What a page was opened from, which focus goes back to once the page closes.
 */
type Opener = {
  /** The subject of the page opened. */
  pageId: string
  /** The element holding focus as it opened. */
  element: HTMLElement
}

/**
 * The subject of the page the address opens this instant, read off the address itself since a render can lag
 * behind it.
 *
 * @returns The subject's id, or null while the address opens no page.
 */
function addressedDetailId(): string | null {
  // The page the address's own query opens, which a step in history reaches before any render does
  return detailOf(new URLSearchParams(window.location.search))?.id ?? null
}

/**
 * The tab a paper's page is on this instant, read off the address itself since a render can lag behind it.
 *
 * @returns The tab.
 */
function addressedPaperTab(): PaperTab {
  // The tab the address's own query names
  return tabOf(new URLSearchParams(window.location.search), PAPER_TABS)
}

/**
 * Where the screen stands this instant, kept by the link to a page where the screen shows one. A paper's only link
 * is on the board, which can stay put while the screen scrolls under it, so leaving for a paper keeps the scroll alone.
 *
 * @param page - The page whose link keeps the spot.
 *
 * @returns The spot.
 */
function spotAt(page: DetailPage): LeftSpot {
  // The scroll, with no link to go by
  const scrolled = { scrollY: window.scrollY, anchor: null }

  // The link the page kind keeps the spot by
  switch (page.kind) {
    case 'proposal': {
      // The problem's link, if the screen shows one
      const link = shownElement(OPEN_ID_ATTRIBUTE.selectorFor(page.id))

      // The scroll, and where the link stands in the view
      return link === null
        ? scrolled
        : { ...scrolled, anchor: { id: page.id, top: link.getBoundingClientRect().top } }
    }
    case 'paper':
      return scrolled

    // Every kind is handled above
    default:
      return assertNever(page)
  }
}

/**
 * Puts focus back on what a page just closed was opened from, where the screen still shows it, or else on the page's
 * link, leaving the screen where it stands.
 *
 * @param opener - What the last page opened was opened from; null for nothing.
 * @param pageId - The subject of the page just closed.
 *
 * @returns Whether the screen showed either.
 */
function returnFocus(opener: Opener | null, pageId: string): boolean {
  // What the page was opened from, where the screen still shows it
  if (opener?.pageId === pageId && opener.element.getClientRects().length > 0) {
    // Focused there, the screen staying where it was
    opener.element.focus({ preventScroll: true })

    // The screen showed it
    return true
  }

  // The page's link otherwise
  return focusShown(OPEN_ID_ATTRIBUTE.selectorFor(pageId))
}

/**
 * How far down to scroll to bring the screen back to a spot: with its anchor where it stood in the view, or at the
 * spot's own scroll where there is no anchor to go by.
 *
 * @param spot - Where the screen was left.
 *
 * @returns The scroll, in pixels from the top.
 */
function scrollFor({ scrollY, anchor }: LeftSpot): number {
  // No link to go by
  if (anchor === null) return scrollY

  // The link, where the screen still shows it
  const link = shownElement(OPEN_ID_ATTRIBUTE.selectorFor(anchor.id))

  // Gone from the screen meanwhile, which leaves the scroll alone to go by
  if (link === null) return scrollY

  // The scroll putting the link back where it stood in the view
  return window.scrollY + link.getBoundingClientRect().top - anchor.top
}

/**
 * The page open in full, a problem's or a paper's, carried in the address so a link to it can be shared. Moving in
 * and out goes through {@link pushQuery}, so the browser's back button steps back through the pages opened. Leaving
 * a page whose subject is gone steps back to the pool or the paper it was just opened from, so Back from there never
 * lands on the same page. A gone subject reached any other way, through history included, has its step taken over
 * by the paper it was opened over, or else the pool, through {@link replaceQuery}, which can never step off the
 * page. Only the page's own parameters change, so the pool's filter rides along. A page starts at the top with focus
 * on its heading. The pool comes back where it was left, and so does a paper coming back from a problem opened over
 * it. Focus there goes back to what opened the page just closed, or else to that page's link, and where the screen
 * shows neither, to the pool's count line or the paper's heading.
 *
 * @returns The open page, the ways in and out of it, and the pool's count line.
 */
export function useOpenDetail(): UseOpenDetailResult {
  // The address's query parameters
  const searchParams = useSearchParams()

  // The page the address opens
  const addressed = detailOf(searchParams)

  // What kind of page it is
  const openKind = addressed?.kind ?? null

  // The subject of the page
  const openId = addressed?.id ?? null

  // The page open, held steady while the address opens the same one
  const detail = useMemo(
    () => (openKind === null || openId === null ? null : { kind: openKind, id: openId }),
    [openKind, openId]
  )

  // Where the pool was last left while it showed
  const poolSpotRef = useRef<LeftSpot>({ scrollY: 0, anchor: null })

  // Where a paper's page was last left while it showed; null until one has shown
  const paperSpotRef = useRef<PaperSpot | null>(null)

  // What the last page opened was opened from; null when focus sat nowhere as it opened
  const openerRef = useRef<Opener | null>(null)

  // The page on screen, null for the pool, as of the last switch committed
  const paintedRef = useRef<OpenDetail | null>(detail)

  // The page last opened from the pool, or the problem last opened from a paper's page, whose step in history comes
  // right after the one it was opened from; null after any other opening, or once a step through history has been
  // taken since
  const openedOverRef = useRef<string | null>(null)

  // Every step through history, which lands on a step openedOverRef can't vouch for
  useWindowEvent('popstate', () => {
    // No page known to sit right after the page it was opened from
    openedOverRef.current = null
  })

  // A function which keeps where the screen stands, for the pool or a paper's page while it is on screen
  const saveSpot = useCallback((spot: LeftSpot) => {
    // The page on screen, null for the pool
    const painted = paintedRef.current

    // The pool's spot
    if (painted === null) {
      // Kept as the pool's
      poolSpotRef.current = spot

      // Nothing more to keep
      return
    }

    // A page's spot, by its kind
    switch (painted.kind) {
      case 'paper':
        // The paper's spot, on the tab it is on
        paperSpotRef.current = { paperId: painted.id, tab: addressedPaperTab(), spot }
        break
      case 'proposal':
        // A problem's page starts from its top every time
        break

      // Every kind is handled above
      default:
        assertNever(painted)
    }
  }, [])

  // The page open on the previous render; undefined on the first
  const previousOpenId = usePrevious(openId)

  // The paper the open problem was opened over, if any
  const paperBeneathId = paperBeneathOf(searchParams)

  // The paper the problem open on the previous render was opened over
  const previousPaperBeneathId = usePrevious(paperBeneathId)

  // The pool's line counting its problems
  const poolCountRef = useRef<HTMLParagraphElement>(null)

  // Place whichever of a page and the pool takes the screen before the switch is painted, and move focus onto it
  useIsomorphicEffect(() => {
    // What the screen shows from this commit on
    paintedRef.current = detail

    // The first render is the browser's to place, which restores a reloaded page on its own, and a run
    // with nothing switched has nothing to move
    if (previousOpenId === undefined || previousOpenId === openId) return

    // Where a paper's page was last left
    const paperSpot = paperSpotRef.current

    // A paper coming back from a problem opened over it, to the tab it was left on
    const isPaperBack =
      previousPaperBeneathId === openId &&
      paperSpot?.paperId === openId &&
      paperSpot.tab === addressedPaperTab()

    // Where the screen comes back to: the pool's spot always, a paper's when it comes back that way, and the top of
    // any other page
    const returnSpot = openId === null ? poolSpotRef.current : isPaperBack ? paperSpot.spot : null

    // The screen there, jumped to since the page scrolls smoothly
    window.scrollTo({ top: returnSpot === null ? 0 : scrollFor(returnSpot), behavior: 'instant' })

    // Focus back on what the page just closed was opened from, or on its link, where the screen came back to a spot
    const isFocusReturned =
      returnSpot !== null &&
      previousOpenId !== null &&
      returnFocus(openerRef.current, previousOpenId)

    // Focus gone back already
    if (isFocusReturned) return

    // Focus otherwise on the pool's count line or on the page's heading, which the reader's next Tab goes on from
    if (openId === null) poolCountRef.current?.focus({ preventScroll: true })
    else focusShown(DETAIL_HEADING_ATTRIBUTE.selectorFor(openId))
  }, [detail, openId, previousOpenId, previousPaperBeneathId])

  // The spot of the pool or a paper's page, saved on every scroll while it shows so it stands ready however it is
  // left. The scroll a switch to another page causes arrives after paintedRef moves on, so it is never saved as the
  // spot of the page left
  useWindowEvent('scroll', () => {
    // The scroll, with no link to go by
    saveSpot({ scrollY: window.scrollY, anchor: null })
  })

  // A function which opens a page
  const openDetail = useCallback(
    (page: DetailPage) => {
      // The asked-for page open already, which another step in history would only repeat
      if (addressedDetailId() === page.id) return

      // The page on screen as the other one opens, null for the pool
      const painted = paintedRef.current

      // Where the pool or a paper's page stands, kept by the opened page's link
      saveSpot(spotAt(page))

      // The element holding focus
      const { activeElement } = document

      // What the page is opened from, where something on the page holds focus
      openerRef.current =
        activeElement instanceof HTMLElement && activeElement !== document.body
          ? { pageId: page.id, element: activeElement }
          : null

      // The page, if its way back leads to the page it is opened from: the pool, or a paper a problem opens over
      openedOverRef.current =
        painted === null || (painted.kind === 'paper' && page.kind === 'proposal') ? page.id : null

      // Where a paper's page was last left
      const paperSpot = paperSpotRef.current

      // Whether the page is the paper beneath the problem on screen, asked for on no tab
      const isPaperBack =
        page.kind === 'paper' &&
        page.tab === undefined &&
        paperSpot?.paperId === page.id &&
        paperBeneathOf(new URLSearchParams(window.location.search)) === page.id

      // The page, a paper coming back on the tab it was left on
      const opened = isPaperBack ? { ...page, tab: paperSpot.tab } : page

      // The page's address as a new step in history, every parameter it doesn't write itself left as it stands
      pushQuery(mergeOwnedParams(detailQuery(opened), PAGE_PARAMS[opened.kind]))
    },
    [saveSpot]
  )

  // A function which goes back to the pool
  const closeDetail = useCallback(() => {
    // The pool showing already, which another step in history would only repeat
    if (addressedDetailId() === null) return

    // The pool's address, as a new step in history
    pushQuery(mergeOwnedParams('', DETAIL_PARAMS))
  }, [])

  // A function which leaves a page whose subject is gone
  const leaveDetail = useCallback(() => {
    // Opened from the page whose step is the one right before it
    if (openedOverRef.current === addressedDetailId()) {
      // Back a step to that page, the gone page's step left ahead of it
      window.history.back()

      // Nothing left to replace
      return
    }

    // The paper the gone page was opened over, if any
    const paperId = paperBeneathOf(new URLSearchParams(window.location.search))

    // The paper's address, or the pool's where the gone page sat over none
    const query =
      paperId === null ? '' : detailQuery({ kind: 'paper', id: paperId, tab: undefined })

    // The gone page's step taken over by that address
    replaceQuery(mergeOwnedParams(query, DETAIL_PARAMS))
  }, [])

  // The open page, the ways in and out of it, and the count line
  return { detail, paperBeneathId, openDetail, closeDetail, leaveDetail, poolCountRef }
}
