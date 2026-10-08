'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import type { Locale } from '@/i18n/i18n'

import { countActiveFilters, matchPool } from '../model/pool-filters'
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

  // The selection if its read has landed, and what the pool is narrowed to with the ways of changing it
  const { selection, poolFilters: filters } = useSelectionWorkspace()

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

      {/* How many made it through, or a loading line until the pool arrives */}
      <p className="mt-4 mb-3 text-sm text-muted">{countLine}</p>

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
            <ProposalCard key={proposal.id} proposal={proposal} language={language} />
          ))}
        </div>
      )}
    </div>
  )
}
