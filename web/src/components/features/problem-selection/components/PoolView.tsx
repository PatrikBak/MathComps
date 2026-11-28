'use client'

import { ArrowDownUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, type RefObject, useState } from 'react'

import { COMPACT_PANEL_CLASS } from '@/components/shared/components/EmptyState'
import { SegmentedSwitch } from '@/components/shared/components/SegmentedSwitch'
import { WaitingChangeButton } from '@/components/shared/components/WaitingChangeButton'
import { WindowVirtualList } from '@/components/shared/components/WindowVirtualList'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import type { TableSort } from '@/components/shared/utils/table-sort'
import { useLastElement } from '@/hooks/use-last-element'
import { useResortableOrder } from '@/hooks/use-resortable-order'
import type { Locale } from '@/i18n/i18n'

import { filterForView, isNarrowed, poolFilterKey } from '../model/pool-filter'
import { matchPool } from '../model/pool-matches'
import { DEFAULT_RATINGS_SORT, type RatingsColumn } from '../model/ratings-order'
import { recommendationTargetsOf } from '../model/recommendation-targets'
import { POOL_VIEWS, type PoolViewMode } from '../model/selection-routes'
import { canPlaceOn } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { LanguageSwitch } from './LanguageSwitch'
import { PoolComments } from './PoolComments'
import { PoolSkeleton } from './PoolSkeleton'
import { PoolTools } from './PoolTools'
import { ProposalCard } from './ProposalCard'
import { ProposalFiling } from './ProposalFiling'
import { RatingsTable } from './RatingsTable'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'
import { WaitingBanner } from './WaitingBanner'

/**
 * Whether each layout of the pool lists its problems, and so carries the slot waiting for one and the spot setting
 * their order again brings the page back to. The discussions list threads instead.
 */
const LISTS_PROBLEMS: Record<PoolViewMode, boolean> = {
  problems: true,
  ratings: true,
  comments: false,
}

/**
 * Whether each layout of the pool draws the search and the filters over itself once the selection has arrived, as the
 * discussions do, which count the filters' options by their own comments.
 */
const DRAWS_OWN_TOOLS: Record<PoolViewMode, boolean> = {
  problems: false,
  ratings: false,
  comments: true,
}

/**
 * Whether each layout of the pool shows the problems' statements, and so, where they need every language, carries the
 * language they are read in. The ratings table and the discussions name each problem by its title, which has no
 * languages, and preview its statement in the language the problems are read in.
 */
const SHOWS_STATEMENTS: Record<PoolViewMode, boolean> = {
  problems: true,
  ratings: false,
  comments: false,
}

/**
 * Whether each layout of the pool keeps its problems where they stood until their order is set again, and so offers
 * to set it. The ratings table opens in that order, and keeps it among the rows whose averages are level.
 */
const HOLDS_ORDER: Record<PoolViewMode, boolean> = {
  problems: true,
  ratings: true,
  comments: false,
}

/**
 * Props for the {@link PoolView} component.
 */
type PoolViewProps = {
  /** The language the problems are read in. */
  language: Locale
  /** Switches the language the problems are read in. */
  onLanguageChange: (language: Locale) => void
}

/**
 * The pool: every problem no round has taken, live or set aside, filtered and read statement by statement, or laid
 * out as a table of their ratings. Where the problems need every language, its language switch keeps each of them in
 * reach, since a {@link PoolCard} lacking the one picked shows another the problem has; where any one text will do,
 * the pool has no switch. The pool also lists the threads of every discussion of what the selection holds. One search
 * and one row of filters narrow every layout, standing in the same spot in each.
 */
export function PoolView({ language, onLanguageChange }: PoolViewProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // The selection if its read has landed, what the pool is narrowed to with the ways of changing it, which layout it
  // shows with the way to change that, the line saying how many problems or comments show, and the slot waiting for
  // a problem
  const {
    selection,
    poolFilters: filters,
    poolView: { option: mode, choose: showMode },
    poolCountRef: countRef,
    waitingSlot,
  } = useSelectionWorkspace()

  // What the pool is narrowed to, as the layout on screen reads it
  const viewFilter = filterForView(filters.filter, mode)

  // What the filter lets through, against the board on screen, while the pool lists its problems; null until the
  // selection arrives, and over the discussions, which run the filter through themselves
  const matches =
    selection !== null && LISTS_PROBLEMS[mode]
      ? matchPool(
          [...selection.proposalsById.values()],
          viewFilter,
          selection.activeBoard,
          recommendationTargetsOf(selection.categories, selection.boards)
        )
      : null

  // Whether a search or a facet narrows the view on screen, set aside or live
  const isViewNarrowed = isNarrowed(viewFilter)

  // That the pool is loading, or how many made it through, counted as the set-aside problems when the list is
  // all of them; the discussions count their comments themselves
  const countLine =
    selection === null
      ? t('loading')
      : matches === null
        ? null
        : viewFilter.isShowingSetAside && !isViewNarrowed
          ? t('setAsideCount', { count: matches.shown.length })
          : tPlurals('problems', { count: matches.shown.length })

  // How many comments across the discussions are new to the reader
  const { newCount: newCommentCount } = useSelectionWorkspace().seenMarks

  // What each of the pool's layouts is called, the discussions with how many of their comments are new
  const modeLabels: Record<PoolViewMode, ReactNode> = {
    problems: t('views.problems'),
    ratings: t('views.ratings'),
    comments: (
      <>
        {t('views.comments')}
        {newCommentCount > 0 && (
          <>
            {/* The new comments, as a number beside the name */}
            <span aria-hidden className="ml-1.5 text-brand-light">
              {newCommentCount}
            </span>

            {/* The new comments, as a screen reader says them */}
            <span className="sr-only">{t('newCount', { count: newCommentCount })}</span>
          </>
        )}
      </>
    ),
  }

  // Why nothing shows: the filters hiding problems, or no problem there to hide, in the view on screen
  const emptyLine = viewFilter.isShowingSetAside
    ? t(isViewNarrowed ? 'emptySetAsideFiltered' : 'emptySetAside')
    : t(isViewNarrowed ? 'empty' : 'emptyPool')

  // How the ratings table orders its rows, kept while nothing matches and while the cards show
  const [ratingsSort, setRatingsSort] = useState(DEFAULT_RATINGS_SORT)

  // Where the discussions say how many comments they show, once it is on the page, kept while the pool hides behind
  // a page, and the ref handing it over
  const [commentCountSlot, keepCommentCountSlot] = useLastElement<HTMLSpanElement>()

  // The slot for the comments order switch, kept while a page covers the pool, and the ref that sets it
  const [commentOrderSlot, keepCommentOrderSlot] = useLastElement<HTMLDivElement>()

  // Where a layout drawing its own search and filters puts them, once it is on the page, kept while the pool hides
  // behind a page, and the ref handing it over
  const [toolsSlot, keepToolsSlot] = useLastElement<HTMLDivElement>()

  // The problems the filters let through, each kept where it stood when their order was last set, whether a change
  // waits, the spot over the list the page comes back to, and the way to set the order again from there
  const { shown, isChangeWaiting, listRef, resortFromTop } = useResortableOrder({
    items: matches?.shown ?? [],
    keyOf: (proposal) => proposal.id,
    // The order set again as the filter the layout reads changes, its search as the pool reads it, and as another
    // board goes on screen
    resetKey: poolFilterKey(viewFilter, selection?.activeBoard ?? null),
    // A problem the filters let through after the order was set goes where the order it comes in puts it
    newcomerPlace: 'inPlace',
    // The focus on the line over the pool as the order is set again
    focusTarget: countRef,
  })

  return (
    <div>
      {/* The way between the pool's lists, and over the problems' statements the language they are read in, where
          they need every language */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <SegmentedSwitch
          value={mode}
          onChange={showMode}
          ariaLabel={t('views.label')}
          options={POOL_VIEWS.map((candidate) => ({
            value: candidate,
            label: modeLabels[candidate],
          }))}
        />
        {SHOWS_STATEMENTS[mode] && selection !== null && selection.needsEveryLanguage && (
          <LanguageSwitch language={language} onChange={onLanguageChange} unwritten={[]} />
        )}
      </div>

      {/* The search and the filters, drawn here unless the layout draws its own in the spot below, out of reach while
          they wait for a layout's own to take their place, so no focus is lost as it does */}
      {(selection === null || !DRAWS_OWN_TOOLS[mode]) && (
        <div inert={DRAWS_OWN_TOOLS[mode]}>
          <PoolTools mode={mode} filters={filters} counts={matches} />
        </div>
      )}

      {/* Where a layout drawing its own search and filters puts them */}
      <div ref={keepToolsSlot} />

      {/* What works on a list of problems */}
      {LISTS_PROBLEMS[mode] && (
        <>
          {/* The spot setting the order again brings the page back to, over the waiting slot and the count */}
          <div ref={listRef} />

          {/* The slot waiting for a problem, kept in view while scrolling where a problem can be picked for it */}
          <WaitingBanner countRef={countRef} />
        </>
      )}

      {/* The line over the pool. The comments order switch stays at its right end while a phone wraps the count */}
      <div className="mt-4 mb-3 flex items-center gap-x-3">
        {/* How many problems or comments show, with how many comments are new, or a loading line */}
        <p
          ref={countRef}
          // Takes the focus when whatever held it goes with nothing in its place, so a reader's next Tab goes on from
          // here
          tabIndex={-1}
          className="min-w-0 flex-1 text-sm text-muted focus:outline-none"
        >
          {countLine}
          <span
            // Filled in by the discussions, which count their own comments
            ref={keepCommentCountSlot}
            // Laid out as part of the line
            className="contents"
          />
        </p>

        {/* The slot for the comments order switch */}
        <div ref={keepCommentOrderSlot} className="contents" />
      </div>

      {/* The problems or the discussions, or whatever stands in for them */}
      {selection === null ? (
        // Placeholder cards while the pool loads
        <PoolSkeleton />
      ) : (
        // The layout asked for, under the offer to set the problems' order again where it holds them
        <>
          {/* The offer to set the order again, once it is out of date in a layout holding it, kept back while a
              slot waits, whose banner holds the same spot */}
          <WaitingChangeButton
            label={t('resort')}
            icon={ArrowDownUp}
            isWaiting={HOLDS_ORDER[mode] && isChangeWaiting && waitingSlot === null}
            onShow={resortFromTop}
            fallbackRef={countRef}
          />

          {/* The layout, handed the problems the filters let through, which the discussions leave unread */}
          <PoolLayout
            mode={mode}
            proposals={shown}
            language={language}
            countRef={countRef}
            commentCountSlot={commentCountSlot}
            commentOrderSlot={commentOrderSlot}
            toolsSlot={toolsSlot}
            emptyLine={emptyLine}
            ratingsSort={ratingsSort}
            onRatingsSort={setRatingsSort}
          />
        </>
      )}
    </div>
  )
}

/**
 * Props for the {@link PoolLayout} component.
 */
type PoolLayoutProps = {
  /** Which layout the pool shows. */
  mode: PoolViewMode
  /** The problems the filters let through. */
  proposals: readonly Proposal[]
  /** The language the problems are read in. */
  language: Locale
  /** The line saying how many problems show. */
  countRef: RefObject<HTMLParagraphElement | null>
  /** Where the discussions say how many comments they show, once it is on the page. */
  commentCountSlot: HTMLElement | null
  /** The slot for the comments order switch, once it is on the page. */
  commentOrderSlot: HTMLElement | null
  /** Where the discussions draw their search and filters, once it is on the page. */
  toolsSlot: HTMLElement | null
  /** Why no problem shows, when none does. */
  emptyLine: string
  /** How the ratings table orders its rows. */
  ratingsSort: TableSort<RatingsColumn>
  /** Orders the ratings table's rows as asked. */
  onRatingsSort: (sort: TableSort<RatingsColumn>) => void
}

/**
 * The layout asked for: the problems the filters let through, as a card each or as a table of their ratings, or the
 * threads of the discussions of what the selection holds, which the discussions run through the filters themselves. A
 * layout of problems says when none shows. The discussions say for themselves when none shows, since the papers'
 * threads can show with no problem in the pool.
 */
function PoolLayout({
  mode,
  proposals,
  language,
  countRef,
  commentCountSlot,
  commentOrderSlot,
  toolsSlot,
  emptyLine,
  ratingsSort,
  onRatingsSort,
}: PoolLayoutProps) {
  // A note saying why no problem shows
  const emptyNote = (
    <div className={COMPACT_PANEL_CLASS}>
      <p className="text-sm text-muted">{emptyLine}</p>
    </div>
  )

  // The layout asked for
  switch (mode) {
    // A card for every problem, only those in or near the window drawn, or the note while none shows
    case 'problems':
      return proposals.length === 0 ? (
        emptyNote
      ) : (
        <WindowVirtualList
          items={proposals}
          keyOf={(proposal) => proposal.id}
          renderItem={(proposal) => <PoolCard proposal={proposal} language={language} />}
          fallbackRef={countRef}
        />
      )

    // A row for every problem, with its ratings, or the note while none shows
    case 'ratings':
      return proposals.length === 0 ? (
        emptyNote
      ) : (
        <RatingsTable
          proposals={proposals}
          language={language}
          sort={ratingsSort}
          onSort={onRatingsSort}
          fallbackRef={countRef}
        />
      )

    // The threads of the problems' and the papers' discussions the filters let through
    case 'comments':
      return (
        <PoolComments
          countSlot={commentCountSlot}
          orderSlot={commentOrderSlot}
          toolsSlot={toolsSlot}
          language={language}
        />
      )

    // Every layout is handled above
    default:
      return assertNever(mode)
  }
}

/**
 * Props for the {@link PoolCard} component.
 */
type PoolCardProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
}

/**
 * A problem's card in the pool, with its filing line and the controls placing it, brightening while a slot waits
 * for a problem it can go into.
 */
function PoolCard({ proposal, language }: PoolCardProps) {
  // The slot waiting for a problem, if any, and the selection holding it
  const { waitingSlot, selection } = useSelectionWorkspace()

  // Whether the reader can put the problem onto the board on screen
  const isPlaceable =
    selection?.activeBoard != null &&
    canPlaceOn(selection.activeBoard, proposal, selection.leadCategories)

  // Whether the problem already fills the waiting slot
  const fillsWaitingSlot =
    waitingSlot !== null &&
    selection?.activeBoard?.papers.find((paper) => paper.id === waitingSlot.paperId)?.slots[
      waitingSlot.index
    ] === proposal.id

  return (
    <ProposalCard
      proposal={proposal}
      language={language}
      leadsToPage
      mark={null}
      // Placing and the menu of actions, with nothing more to do once the problem is deleted
      actions={{}}
      details={<ProposalFiling proposal={proposal} />}
      className={cn(
        'transition-colors',
        // A card's border brightens while a slot waits for a problem, which it can go into
        waitingSlot !== null && isPlaceable && !fillsWaitingSlot && 'border-foreground/15',
        // A set-aside problem, dimmed
        proposal.isSetAside && 'opacity-70'
      )}
    />
  )
}
