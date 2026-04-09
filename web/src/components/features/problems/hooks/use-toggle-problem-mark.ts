import { useTranslations } from 'next-intl'

import { PENDING_PROBLEM_MARK_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useProblemStore } from '@/stores/problem-store'

import { toggleProblemMark } from '../services/problem-service'
import { problemQueryKeys } from './use-problem-search-query'
import { useToggleProblemAction } from './use-toggle-problem-action'

/**
 * Hook to toggle marks on problems.
 *
 * Thin wrapper over {@link useToggleProblemAction} with mark-specific config.
 */
export function useToggleProblemMark() {
  // Get translations for this feature
  const t = useTranslations('problems.marks')

  // Get store action
  const toggleProblemMarkInStore = useProblemStore((state) => state.toggleProblemMark)

  // Get current filters to check if we're viewing marked only
  const currentFilters = useProblemStore((state) => state.currentFilters)

  // Reuse common abstraction for toggle action
  return useToggleProblemAction({
    apiFn: toggleProblemMark,
    toggleInStore: toggleProblemMarkInStore,
    stateKey: 'marked',
    // Any mark status filter creates a filtered view (both 'marked' and 'unmarked')
    isFilteredView: () => !!currentFilters?.markStatus,
    // Unmarking in "marked" view or marking in "unmarked" view removes the item
    willLeaveFilteredView: (isActive) =>
      (currentFilters?.markStatus === 'marked' && isActive) ||
      (currentFilters?.markStatus === 'unmarked' && !isActive),
    invalidateQueryKeys: problemQueryKeys.allSearches(),
    pendingStorageKey: PENDING_PROBLEM_MARK_STORAGE_KEY,
    messages: {
      authReason: t('authReason'),
      removedMessage: t('removedFromMarked'),
      undoLabel: t('undo'),
      errorMessage: t('markToggleFailed'),
    },
  })
}
