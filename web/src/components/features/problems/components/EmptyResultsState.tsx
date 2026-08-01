'use client'

import { ServerCrash } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * The props of {@link EmptyResultsState}.
 */
type EmptyResultsStateProps = {
  /** The state of the search the missing rows would have come from. */
  searchState: QueryUiState
  /** Runs the failed search again. */
  onRetry: () => void
}

/**
 * Fills the result list when it has no rows, naming which of the very different reasons is behind
 * that: the filters matched nothing, or the search never got an answer.
 */
export const EmptyResultsState = ({ searchState, onRetry }: EmptyResultsStateProps) => {
  // Translations for the problems section
  const t = useTranslations('problems')

  // Translations for problem-related errors
  const tErrors = useTranslations('problems.errors')

  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  // An outage must not read as filters that matched nothing, so each state says its own piece
  switch (searchState.kind) {
    // Every attempt is spent, so another one has to be asked for
    case 'failed':
      return (
        <PlaceholderCard title={tErrors('searchFailed')} hint={tErrors('searchFailedHint')}>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
            {tActions('retry')}
          </Button>
        </PlaceholderCard>
      )

    // The request is held back until the connection returns, which it does by itself
    case 'offline':
      return <PlaceholderCard title={t('offlineTitle')} hint={t('offlineHint')} />

    // Nothing is wrong with the search, so the filters really did match nothing
    case 'ready':
    case 'loading':
    case 'retrying':
      return <PlaceholderCard title={t('emptyState.title')} hint={t('emptyState.description')} />

    // Every state is handled above
    default:
      return assertNever(searchState)
  }
}

/**
 * The props of {@link PlaceholderCard}.
 */
type PlaceholderCardProps = {
  /** The headline naming why the list is empty. */
  title: string
  /** The explanation under it. */
  hint: string
  /** Any way out of the situation. */
  children?: React.ReactNode
}

/**
 * The card that stands in the list's place, shared by every reason it can be empty.
 */
const PlaceholderCard = ({ title, hint, children }: PlaceholderCardProps) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-foreground/10 bg-surface/50 py-20 text-center">
    <ServerCrash size={48} className="mb-4 text-muted" />
    <h3 className="text-xl font-semibold text-foreground">{title}</h3>
    <p className="mt-2 text-muted">{hint}</p>
    {children}
  </div>
)
