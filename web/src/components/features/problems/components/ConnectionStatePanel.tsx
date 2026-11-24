'use client'

import { Loader2, ServerCrash, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { ResultsPlaceholder } from '@/components/shared/components/ResultsPlaceholder'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * The states this panel exists for: the page has nothing to show, and the fetch behind it is why.
 */
type ConnectionState = Extract<QueryUiState, { kind: 'failed' | 'offline' | 'retrying' }>

/**
 * The props of {@link ConnectionStatePanel}.
 */
type ConnectionStatePanelProps = {
  /** The state to explain. */
  state: ConnectionState
  /** Runs the failed fetch again. */
  onRetry: () => void
}

/**
 * Explains why the page has nothing to show, for the states where the reason is the fetch
 * rather than the content.
 *
 * The spinner belongs to the retrying state alone: a settled failure gets a button instead, because
 * nothing further will happen on its own until the reader (or a return to the tab) asks for it.
 */
export function ConnectionStatePanel({ state, onRetry }: ConnectionStatePanelProps) {
  // Translations for the problems section
  const t = useTranslations('problems')

  // Translations for problem-related errors
  const tErrors = useTranslations('problems.errors')

  // Translations for the shared action labels
  const tActions = useTranslations('ui.actions')

  // Each state gets its own explanation, and its own answer to what the reader can do about it
  switch (state.kind) {
    // A request really is in flight after an earlier attempt failed
    case 'retrying':
      return (
        <ResultsPlaceholder
          icon={WifiOff}
          title={t('connectionFailed')}
          hint={t('tryingToConnect')}
        >
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted" />
        </ResultsPlaceholder>
      )

    // Every attempt is spent, so the next one has to be asked for. A server that answered and
    // refused is not an unreachable one, so nothing in the panel may describe it as one
    case 'failed':
      return (
        <ResultsPlaceholder
          icon={state.isPermanent ? ServerCrash : WifiOff}
          title={state.isPermanent ? tErrors('searchFailed') : t('connectionFailed')}
          hint={state.isPermanent ? tErrors('unexpectedError') : t('connectionFailedHint')}
        >
          <Button variant="secondary" size="sm" shape="pill" className="mt-4" onClick={onRetry}>
            {tActions('retry')}
          </Button>
        </ResultsPlaceholder>
      )

    // The request is held back until the connection returns, which it does by itself
    case 'offline':
      return <ResultsPlaceholder icon={WifiOff} title={t('offlineTitle')} hint={t('offlineHint')} />

    // Every state is handled above
    default:
      return assertNever(state)
  }
}
