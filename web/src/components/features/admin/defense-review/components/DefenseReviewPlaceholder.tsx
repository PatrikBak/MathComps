import { Inbox, SearchX } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import {
  COMPACT_PANEL_CLASS,
  FilterEmptyState,
} from '@/components/shared/components/FilterEmptyState'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * Props for the {@link DefenseReviewPlaceholder} component.
 */
type DefenseReviewPlaceholderProps = {
  /** What the fetch is doing. */
  uiState: QueryUiState
  /** Whether anything is narrowing the queue, which decides what an empty result means. */
  isFiltered: boolean
  /** Runs the query again after it failed. */
  onRetry: () => void
  /** Returns the queue to showing everything. */
  onClearFilters: () => void
}

/**
 * What the review queue shows when it holds nothing: still loading, nothing to show, nothing left after the
 * filters, or unreachable. Every case says what happened rather than leaving an empty column.
 */
export function DefenseReviewPlaceholder({
  uiState,
  isFiltered,
  onRetry,
  onClearFilters,
}: DefenseReviewPlaceholderProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  return (
    <FetchStatePlaceholder
      uiState={uiState}
      className={COMPACT_PANEL_CLASS}
      // Nothing matched, which the reader can do something about only when they narrowed it themselves
      empty={
        isFiltered ? (
          <FilterEmptyState
            message={t('emptyFiltered')}
            resetLabel={t('clearFilters')}
            onReset={onClearFilters}
            icon={SearchX}
            compact
          />
        ) : (
          <div className={COMPACT_PANEL_CLASS}>
            <Inbox size={22} className="text-muted" aria-hidden="true" />
            <p className="font-medium text-foreground">{t('empty')}</p>
            <p className="text-sm text-muted">{t('emptyHint')}</p>
          </div>
        )
      }
      // It gave up, and the whole page is riding on this one fetch, so the way to ask again stands here
      failed={
        <div className={COMPACT_PANEL_CLASS}>
          <p className="font-medium text-foreground">{t('failed')}</p>
          <p className="text-sm text-muted">{t('failedHint')}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {tActions('retry')}
          </Button>
        </div>
      }
    />
  )
}
