'use client'

import { ArrowDownUp, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type RefObject, useCallback, useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import { SegmentedSwitch } from '@/components/shared/components/SegmentedSwitch'
import { WaitingChangeButton } from '@/components/shared/components/WaitingChangeButton'
import { WindowVirtualList } from '@/components/shared/components/WindowVirtualList'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { focusForReader } from '@/components/shared/utils/focus-utils'
import type { TableSort } from '@/components/shared/utils/table-sort'
import { useResortableOrder } from '@/hooks/use-resortable-order'
import type { Locale } from '@/i18n/i18n'

import { usePoolViewMode } from '../hooks/use-pool-view-mode'
import { countActiveFilters, matchPool } from '../model/pool-filters'
import { DEFAULT_RATINGS_SORT, type RatingsColumn } from '../model/ratings-order'
import { POOL_VIEWS, type PoolViewMode } from '../model/selection-routes'
import { canPlaceOn } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { SlotNumber } from './CategoryMarks'
import { LanguageSwitch } from './LanguageSwitch'
import { PlaceControl } from './PlaceControl'
import { PoolComments } from './PoolComments'
import { PoolFilterBar } from './PoolFilterBar'
import { PoolSkeleton } from './PoolSkeleton'
import { ProposalActionsMenu } from './ProposalActionsMenu'
import { ProposalCard } from './ProposalCard'
import { ProposalFiling } from './ProposalFiling'
import { RatingsTable } from './RatingsTable'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Whether each layout of the pool lists its problems, and so carries the tools that work on them. The discussions
 * list every thread instead, whatever the filters say.
 */
const LISTS_PROBLEMS: Record<PoolViewMode, boolean> = {
  problems: true,
  ratings: true,
  comments: false,
}

/**
 * Whether each layout of the pool shows the problems' statements, and so, where they need every language, carries the
 * language they are read in. The ratings table names each problem by its title alone, which has no languages.
 */
const SHOWS_STATEMENTS: Record<PoolViewMode, boolean> = {
  problems: true,
  ratings: false,
  comments: false,
}

/**
 * Whether each layout of the pool keeps its problems where they stood until their order is set again, and so offers
 * to set it. The ratings table orders its rows by the column picked.
 */
const HOLDS_ORDER: Record<PoolViewMode, boolean> = {
  problems: true,
  ratings: false,
  comments: false,
}

/**
 * Whether the line over each layout of the pool carries the eye marking what is new as seen.
 */
const CARRIES_EYE: Record<PoolViewMode, boolean> = {
  problems: false,
  ratings: false,
  comments: true,
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
 * the pool has no switch. The pool also lists every discussion of what the selection holds.
 */
export function PoolView({ language, onLanguageChange }: PoolViewProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // The selection if its read has landed, what the pool is narrowed to with the ways of changing it, the line saying
  // how many problems or comments show, and the slot waiting for a problem
  const {
    selection,
    poolFilters: filters,
    poolCountRef: countRef,
    waitingSlot,
  } = useSelectionWorkspace()

  // Which layout the pool shows, and the way to change it
  const { mode, showMode } = usePoolViewMode()

  // What the filter lets through, against the board on screen, while the pool lists its problems; null until the
  // selection arrives, and over the discussions, which no filter narrows
  const matches =
    selection !== null && LISTS_PROBLEMS[mode]
      ? matchPool(
          [...selection.proposalsById.values()],
          filters.filter,
          selection.activeBoard,
          selection.categories
        )
      : null

  // Whether a search, a facet or leaving out what the board holds narrows the view on screen, set aside or live
  const isNarrowed = countActiveFilters({ ...filters.filter, isShowingSetAside: false }) > 0

  // That the pool is loading, or how many made it through, counted as the set-aside problems when the list is
  // all of them; the discussions count their comments themselves
  const countLine =
    selection === null
      ? t('loading')
      : matches === null
        ? null
        : filters.filter.isShowingSetAside && !isNarrowed
          ? t('setAsideCount', { count: matches.shown.length })
          : tPlurals('problems', { count: matches.shown.length })

  // What each of the pool's layouts is called
  const modeLabels: Record<PoolViewMode, string> = {
    problems: t('views.problems'),
    ratings: t('views.ratings'),
    comments: t('views.comments'),
  }

  // Why nothing shows: the filters hiding problems, or no problem there to hide, in the view on screen
  const emptyLine = filters.filter.isShowingSetAside
    ? t(isNarrowed ? 'emptySetAsideFiltered' : 'emptySetAside')
    : t(isNarrowed ? 'empty' : 'emptyPool')

  // How the ratings table orders its rows, kept while nothing matches and while the cards show
  const [ratingsSort, setRatingsSort] = useState(DEFAULT_RATINGS_SORT)

  // Where the discussions say how many comments they show, once it is on the page
  const [commentCountSlot, setCommentCountSlot] = useState<HTMLSpanElement | null>(null)

  // A function which keeps the comment count's place once it is on the page, as it stays while the pool hides
  // behind a page
  const keepCommentCountSlot = useCallback((slot: HTMLSpanElement | null) => {
    // Kept only as it arrives
    if (slot !== null) setCommentCountSlot(slot)
  }, [])

  // The problems the filters let through, each kept where it stood when their order was last set, whether a change
  // waits, the spot over the list the page comes back to, and the way to set the order again from there
  const { shown, isChangeWaiting, listRef, resortFromTop } = useResortableOrder({
    items: matches?.shown ?? [],
    keyOf: (proposal) => proposal.id,
    // The order set again as the filter changes, its search as the pool reads it, and as another board goes on screen
    resetKey: JSON.stringify([
      { ...filters.filter, query: filters.filter.query.trim() },
      selection?.activeBoard?.id ?? null,
    ]),
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

      {/* The tools over a list of problems, which the discussions go without */}
      {LISTS_PROBLEMS[mode] && (
        <>
          {/* Search */}
          <label className="relative mt-4 block">
            <span className="sr-only">{t('search')}</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={filters.filter.query}
              onChange={(event) => filters.setField('query', event.target.value)}
              placeholder={t('searchPlaceholder')}
              // Drawn as light and as tall as the facet pills below, since it sits on the page itself
              className={cn(
                'form-input border-foreground/10 bg-foreground/[0.03] py-1.5 pl-9 placeholder:text-muted',
                'hover:border-foreground/25 hover:bg-foreground/[0.07] focus-visible:border-focus/70'
              )}
            />
          </label>

          {/* Narrowing the pool down */}
          <div className="mt-3">
            <PoolFilterBar filters={filters} matches={matches} />
          </div>

          {/* The spot setting the order again brings the page back to, over the waiting slot and the count */}
          <div ref={listRef} />

          {/* The slot waiting for a problem, kept in view while scrolling where a problem can be picked for it */}
          <WaitingBanner countRef={countRef} />
        </>
      )}

      {/* How many problems or comments show, with how many comments are new, or a loading line */}
      <p
        ref={countRef}
        // Takes the focus when whatever held it goes with nothing in its place, so a reader's next Tab goes on from
        // here
        tabIndex={-1}
        className={cn(
          'mt-4 mb-3 text-sm text-muted focus:outline-none',
          // As tall from the start as the eye it carries, which appears on it later
          CARRIES_EYE[mode] && 'flex min-h-9 flex-wrap items-center'
        )}
      >
        {countLine}
        <span
          // Filled in by the discussions, which count their own comments
          ref={keepCommentCountSlot}
          // Laid out as part of the line
          className="contents"
        />
      </p>

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
  /** Why no problem shows, when none does. */
  emptyLine: string
  /** How the ratings table orders its rows. */
  ratingsSort: TableSort<RatingsColumn>
  /** Orders the ratings table's rows as asked. */
  onRatingsSort: (sort: TableSort<RatingsColumn>) => void
}

/**
 * The layout asked for: the problems the filters let through, as a card each or as a table of their ratings, or every
 * discussion of what the selection holds. A layout of problems says when none shows. The discussions say for
 * themselves when there are none, since the papers' discussions can show with no problem in the pool.
 */
function PoolLayout({
  mode,
  proposals,
  language,
  countRef,
  commentCountSlot,
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
          sort={ratingsSort}
          onSort={onRatingsSort}
          fallbackRef={countRef}
        />
      )

    // Every discussion of the problems and the papers, newest activity first
    case 'comments':
      return <PoolComments countSlot={commentCountSlot} />

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
      actions={
        <>
          <PlaceControl proposal={proposal} />
          <ProposalActionsMenu proposal={proposal} />
        </>
      }
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

/**
 * Props for the {@link WaitingBanner} component.
 */
type WaitingBannerProps = {
  /** The line under the banner saying how many problems show, which takes the focus when the banner goes. */
  countRef: RefObject<HTMLParagraphElement | null>
}

/**
 * Says which slot is waiting for a problem, and lets it go.
 */
function WaitingBanner({ countRef }: WaitingBannerProps) {
  // Picking copy
  const t = useTranslations('problemSelection.picking')

  // The selection, the slot waiting for a problem, and the way to let it go
  const { selection, waitingSlot, stopWaiting } = useSelectionWorkspace()

  // The board on screen, once the selection has arrived
  const activeBoard = selection?.activeBoard ?? null

  // The waiting slot's paper, undefined while no slot is waiting
  const paper =
    waitingSlot === null
      ? undefined
      : activeBoard?.papers.find((candidate) => candidate.id === waitingSlot.paperId)

  // Nothing is waiting on the board on screen
  if (waitingSlot === null || paper === undefined || activeBoard === null) return null

  // A function which lets the slot go, the focus moving on before the banner leaves with the button
  const letGo = () => {
    // The focus on the line below, the page staying where it was
    focusForReader(countRef.current, { preventScroll: true })

    // The slot let go, which takes the banner away
    stopWaiting()
  }

  return (
    <div
      className={cn(
        'sticky-below-header top-[calc(var(--header-height)+8px)] mt-4',
        'flex items-center gap-3 px-3 py-2 text-sm',
        'rounded-lg border border-brand/40 bg-background/95 shadow-lg backdrop-blur'
      )}
    >
      {/* The slot's short label */}
      <SlotNumber paper={paper} index={waitingSlot.index} state="highlighted" />

      {/* Where the next pick goes */}
      <span className="min-w-0 flex-1 text-muted-foreground">
        {t('target', {
          board: activeBoard.name,
          paper: paper.name,
          position: waitingSlot.index + 1,
        })}
      </span>

      {/* The way to let the slot go */}
      <Button size="icon" variant="ghost" aria-label={t('stop')} onClick={letGo}>
        <X size={16} />
      </Button>
    </div>
  )
}
