import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ContextProp } from 'react-virtuoso'

import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * What the infinite scroll is doing, which the end of the list reports.
 */
export type PaginationFooterState = {
  /** Whether the next page is on its way. */
  isLoading: boolean
  /** The state of the search the next page would come from. */
  searchState: QueryUiState
  /** Whether the list has further pages to extend into. */
  hasMore: boolean
}

/**
 * Closes the result list with whatever the infinite scroll is currently doing.
 *
 * It reports and nothing more: a control here rides the list, so it lands below the fold the moment this box appears,
 * and the way to act on a failure lives in the notice floating above the page instead. Each state with something to
 * report renders one centered line, so the box keeps its height under a reader parked at the end of the list.
 */
export function PaginationFooter({
  context: { isLoading, searchState, hasMore },
}: ContextProp<PaginationFooterState>) {
  // Translations for the problems section
  const t = useTranslations('problems')

  // The next page is on its way, whether for the first time or after an attempt that failed
  if (isLoading || searchState.kind === 'retrying') {
    return (
      <div className="py-4 sm:py-6 lg:py-8 flex justify-center">
        <div className="flex items-center gap-3 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t('loadingMore')}</span>
        </div>
      </div>
    )
  }

  // The loaded rows survived the failure, so only the way to extend them is missing
  if (hasMore && searchState.kind === 'failed') {
    return (
      <div className="py-4 sm:py-6 lg:py-8 flex justify-center">
        <span className="text-sm text-muted">{t('errors.loadMoreFailed')}</span>
      </div>
    )
  }

  // Nothing to say at the end of the list
  return null
}
