'use client'

import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode, RefObject } from 'react'

import { Button } from '@/components/shared/components/Button'
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import { cn } from '@/components/shared/utils/css-utils'
import { useFocusHandOff } from '@/hooks/use-focus-hand-off'
import type { Locale } from '@/i18n/i18n'

import { countActiveFilters, matchPool } from '../model/pool-filters'
import { SlotNumber } from './CategoryMarks'
import { LanguageSwitch } from './LanguageSwitch'
import { PoolFilterBar } from './PoolFilterBar'
import { ProposalCard } from './ProposalCard'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

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
 * The pool: every problem no round has taken, live or set aside, filtered and read statement by statement. Its
 * language switch keeps every language in reach, since a {@link ProposalCard} lacking the one picked shows another the problem has.
 */
export function PoolView({ language, onLanguageChange }: PoolViewProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // The selection if its read has landed, what the pool is narrowed to with the ways of changing it, and the line
  // saying how many problems show
  const { selection, poolFilters: filters, poolCountRef: countRef } = useSelectionWorkspace()

  // What the filter lets through, against the board on screen; null until the selection arrives
  const matches =
    selection === null
      ? null
      : matchPool([...selection.proposalsById.values()], filters.filter, selection.activeBoard)

  // Whether a search, a facet or leaving out what the board holds narrows the view on screen, set aside or live
  const isNarrowed = countActiveFilters({ ...filters.filter, isShowingSetAside: false }) > 0

  // That the pool is loading, or how many made it through, counted as the set-aside problems when the list is
  // all of them
  const countLine =
    matches === null
      ? t('loading')
      : filters.filter.isShowingSetAside && !isNarrowed
        ? t('setAsideCount', { count: matches.shown.length })
        : tPlurals('problems', { count: matches.shown.length })

  // Why nothing shows: the filters hiding problems, or no problem there to hide, in the view on screen
  const emptyLine = filters.filter.isShowingSetAside
    ? t(isNarrowed ? 'emptySetAsideFiltered' : 'emptySetAside')
    : t(isNarrowed ? 'empty' : 'emptyPool')

  return (
    <div>
      {/* Search and the language statements are read in */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
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
            className="form-input pl-9"
          />
        </label>

        <LanguageSwitch language={language} onChange={onLanguageChange} unwritten={[]} />
      </div>

      {/* Narrowing the pool down */}
      <div className="mt-3">
        <PoolFilterBar filters={filters} matches={matches} />
      </div>

      {/* The slot waiting for a problem, kept in view while scrolling */}
      <WaitingBanner countRef={countRef} />

      {/* How many made it through, or a loading line until the pool arrives */}
      <p
        ref={countRef}
        // Takes the focus when whatever held it goes with nothing in its place, so a reader's next Tab goes on to the
        // problems
        tabIndex={-1}
        className="mt-4 mb-3 text-sm text-muted focus:outline-none"
      >
        {countLine}
      </p>

      {/* The problems, or whatever stands in for them */}
      {matches === null ? (
        // Placeholder cards while the pool loads
        <div className="space-y-4" aria-hidden>
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-48 animate-pulse rounded-xl bg-surface/25" />
          ))}
        </div>
      ) : matches.shown.length === 0 ? (
        // A note saying why nothing shows
        <div className={COMPACT_PANEL_CLASS}>
          <p className="text-sm text-muted">{emptyLine}</p>
        </div>
      ) : (
        // A card for every problem the filters let through
        <div className="space-y-4">
          {matches.shown.map((proposal) => (
            <PoolEntry key={proposal.id} countRef={countRef}>
              <ProposalCard proposal={proposal} language={language} />
            </PoolEntry>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Props for the {@link PoolEntry} component.
 */
type PoolEntryProps = {
  /** The line saying how many problems show. */
  countRef: RefObject<HTMLParagraphElement | null>
  /** The card. */
  children: ReactNode
}

/**
 * One card's place in the pool. A card leaving the pool while it holds the focus, like one placed on the board while
 * the pool shows only what the board doesn't hold, hands the focus on as {@link useFocusHandOff} does, the count line
 * taking it when no card stands in its place.
 */
function PoolEntry({ countRef, children }: PoolEntryProps) {
  // The focus handed on as the card leaves holding it
  const handOff = useFocusHandOff(countRef)

  return <div {...handOff}>{children}</div>
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
    countRef.current?.focus({ preventScroll: true })

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
