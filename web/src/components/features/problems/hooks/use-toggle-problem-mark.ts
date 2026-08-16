import { useTranslations } from 'next-intl'

import { PENDING_PROBLEM_MARK_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useProblemStore } from '@/stores/problem-store'

import { toggleProblemMark } from '../services/problem-service'
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

  // Reuse common abstraction for toggle action
  return useToggleProblemAction({
    apiFn: toggleProblemMark,
    toggleInStore: toggleProblemMarkInStore,
    toggles: 'marked',
    movesListCounts: false,
    pendingStorageKey: PENDING_PROBLEM_MARK_STORAGE_KEY,
    messages: {
      authReason: t('authReason'),
      removedMessage: t('removedFromMarked'),
      undoLabel: t('undo'),
      errorMessage: t('markToggleFailed'),
    },
  })
}
