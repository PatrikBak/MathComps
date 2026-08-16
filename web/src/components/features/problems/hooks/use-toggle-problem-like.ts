import { useTranslations } from 'next-intl'

import { PENDING_PROBLEM_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useProblemStore } from '@/stores/problem-store'

import { toggleProblemLike } from '../services/problem-service'
import { useToggleProblemAction } from './use-toggle-problem-action'

/**
 * Hook to toggle likes on problems.
 *
 * Thin wrapper over {@link useToggleProblemAction} with like-specific config.
 */
export function useToggleProblemLike() {
  // Get translations for this feature
  const t = useTranslations('problems.favorites')

  // Get store action
  const toggleProblemLikeInStore = useProblemStore((state) => state.toggleProblemLike)

  // Reuse common abstraction for toggle action
  return useToggleProblemAction({
    apiFn: toggleProblemLike,
    toggleInStore: toggleProblemLikeInStore,
    toggles: 'liked',
    movesListCounts: true,
    pendingStorageKey: PENDING_PROBLEM_LIKE_STORAGE_KEY,
    messages: {
      authReason: t('authReason'),
      removedMessage: t('removedFromFavorites'),
      undoLabel: t('undo'),
      errorMessage: t('likeToggleFailed'),
    },
  })
}
