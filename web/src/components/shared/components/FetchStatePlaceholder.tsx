'use client'

import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * Props for the {@link FetchStatePlaceholder} component.
 */
type FetchStatePlaceholderProps = {
  /** What the fetch is doing. */
  uiState: QueryUiState
  /** What stands in place of the results once the fetch arrived and held nothing. */
  empty: React.ReactNode
  /** What stands in place of the results once the fetch gave up. */
  failed: React.ReactNode
  /** Classes for the column the waiting and connection states stand in. */
  className: string
}

/**
 * What a surface shows in place of what it was reading.
 *
 * Waiting and losing the connection read the same wherever they happen, so they are worded here once.
 * What an empty result and a failure mean is the surface's own business.
 */
export function FetchStatePlaceholder({
  uiState,
  empty,
  failed,
  className,
}: FetchStatePlaceholderProps) {
  // Connection copy
  const t = useTranslations('ui.network')

  // What stands in place of the results depends on how far the fetch got
  switch (uiState.kind) {
    // Nothing has arrived yet
    case 'loading':
      return (
        <div className={className}>
          <LoadingSpinner />
        </div>
      )

    // Still trying, so a spinner is the honest thing to show
    case 'retrying':
      return (
        <div className={className}>
          <LoadingSpinner />
          <p className="text-sm text-muted">{t('retrying')}</p>
        </div>
      )

    // The connection went before it did. No retry: the fetch resumes by itself once it is back.
    case 'offline':
      return (
        <div className={className}>
          <WifiOff size={22} className="text-muted" aria-hidden="true" />
          <p className="font-medium text-foreground">{t('offlineTitle')}</p>
          <p className="text-sm text-muted">{t('offlineHint')}</p>
        </div>
      )

    // It gave up, which the surface says in its own words
    case 'failed':
      return failed

    // It arrived and held nothing, which is not the same as never arriving
    case 'ready':
      return empty

    // A state outside the union, which the type system rules out
    default:
      return assertNever(uiState)
  }
}
