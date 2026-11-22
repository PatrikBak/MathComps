'use client'

import { FilterX, Heart, List, type LucideIcon, ServerCrash, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { EmptyState } from '@/components/shared/components/EmptyState'
import { ResultsPlaceholder } from '@/components/shared/components/ResultsPlaceholder'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { SearchFiltersState } from '../types/problem-library-types'
import { type EmptyListReason, emptyListReason } from '../utils/empty-list-reason'
import { clearFilters } from '../utils/filter-update-utils'
import { createDefaultFilters } from '../utils/url-initialization'

/**
 * What an answered search holding no problem offers, for one reason it can be empty.
 */
type EmptyListWayOut = {
  /** The mark above the message. */
  icon: LucideIcon
  /** The key of the button's label among the problems' copy. */
  labelKey: 'filters.resetFilters' | 'emptyState.showAll'
  /** The filters the button leads to, from the ones the search ran under. */
  leadsTo: (filters: SearchFiltersState) => SearchFiltersState
}

/**
 * The way out of an empty list, for each reason it can be empty: the filters cleared within the list, or every
 * problem shown where the favorites or a list are simply empty.
 */
const EMPTY_LIST_WAYS_OUT: Record<EmptyListReason, EmptyListWayOut> = {
  filters: { icon: FilterX, labelKey: 'filters.resetFilters', leadsTo: clearFilters },
  favorites: { icon: Heart, labelKey: 'emptyState.showAll', leadsTo: createDefaultFilters },
  list: { icon: List, labelKey: 'emptyState.showAll', leadsTo: createDefaultFilters },
}

/**
 * The props of {@link EmptyResultsState}.
 */
type EmptyResultsStateProps = {
  /** The state of the search the missing rows would have come from. */
  searchState: QueryUiState
  /** Runs the failed search again. */
  onRetry: () => void
  /** The filters the search ran under. */
  filters: SearchFiltersState
  /** Applies the filters a way out of the empty list leads to. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
}

/**
 * Fills the result list when it has no rows, naming which of the very different reasons is behind that: the search
 * failed or waits for the connection, the filters matched nothing, or the favorites or the list being browsed hold no
 * problem yet. Every reason the reader can act on offers its own way out.
 */
export const EmptyResultsState = ({
  searchState,
  onRetry,
  filters,
  onFiltersChange,
}: EmptyResultsStateProps) => {
  // Translations for the problems section
  const t = useTranslations('problems')

  // Translations for problem-related errors
  const tErrors = useTranslations('problems.errors')

  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  // An outage must not read as filters that matched nothing, so each state says its own piece
  switch (searchState.kind) {
    // Every attempt is spent, so another one has to be asked for. A server that refused did respond, so its hint is
    // the generic error
    case 'failed':
      return (
        <ResultsPlaceholder
          icon={ServerCrash}
          title={tErrors('searchFailed')}
          hint={searchState.isPermanent ? tErrors('unexpectedError') : tErrors('searchFailedHint')}
        >
          <Button variant="secondary" size="sm" shape="pill" className="mt-4" onClick={onRetry}>
            {tActions('retry')}
          </Button>
        </ResultsPlaceholder>
      )

    // The request is held back until the connection returns, which it does by itself
    case 'offline':
      return <ResultsPlaceholder icon={WifiOff} title={t('offlineTitle')} hint={t('offlineHint')} />

    // The rows on screen come from a search that answered, so the list really holds nothing
    case 'ready':
    case 'loading':
    case 'retrying':
      return <EmptyList filters={filters} onFiltersChange={onFiltersChange} />

    // Every state is handled above
    default:
      return assertNever(searchState)
  }
}

/**
 * The props of {@link EmptyList}.
 */
type EmptyListProps = {
  /** The filters the search ran under. */
  filters: SearchFiltersState
  /** Applies the filters the way out leads to. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
}

/**
 * An answered search holding no problem, saying why and offering the way out.
 */
function EmptyList({ filters, onFiltersChange }: EmptyListProps) {
  // Translations for the problems section
  const t = useTranslations('problems')

  // Why there is nothing to show
  const reason = emptyListReason(filters)

  // What the reader is offered for that reason
  const wayOut = EMPTY_LIST_WAYS_OUT[reason]

  return (
    <EmptyState
      message={t(`emptyState.${reason}`)}
      actionLabel={t(wayOut.labelKey)}
      onAction={() => onFiltersChange(wayOut.leadsTo(filters))}
      icon={wayOut.icon}
    />
  )
}
