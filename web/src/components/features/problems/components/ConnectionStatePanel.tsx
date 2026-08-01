'use client'

import { Loader2, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * The states this panel exists for: the page has nothing to show, and the connection is why.
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
 * Explains why the page has nothing to show, for the states where the reason is the connection
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
        <PanelShell title={t('connectionFailed')}>
          <div className="flex items-center justify-center gap-3 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t('tryingToConnect')}</span>
          </div>
        </PanelShell>
      )

    // Every attempt is spent, so the next one has to be asked for. A server that answered and
    // refused is not an unreachable one, so neither the headline nor the hint may describe it as one
    case 'failed':
      return (
        <PanelShell title={state.isPermanent ? tErrors('searchFailed') : t('connectionFailed')}>
          <p className="text-sm text-muted">
            {state.isPermanent ? tErrors('unexpectedError') : t('connectionFailedHint')}
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
            {tActions('retry')}
          </Button>
        </PanelShell>
      )

    // The request is held back until the connection returns, which it does by itself
    case 'offline':
      return (
        <PanelShell title={t('offlineTitle')}>
          <p className="text-sm text-muted">{t('offlineHint')}</p>
        </PanelShell>
      )

    // Every state is handled above
    default:
      return assertNever(state)
  }
}

/**
 * The props of {@link PanelShell}.
 */
type PanelShellProps = {
  /** The headline naming what went wrong. */
  title: string
  /** The explanation and any way out. */
  children: React.ReactNode
}

/**
 * The icon, headline, and centering shared by every state the panel renders.
 */
function PanelShell({ title, children }: PanelShellProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center text-center">
        <WifiOff className="mb-4 h-16 w-16 text-error/60" />
        <h2 className="mb-2 text-2xl font-bold text-foreground">{title}</h2>
        {children}
      </div>
    </div>
  )
}
