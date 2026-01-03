import { PENDING_PROBLEM_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useRestorePendingLike } from '@/hooks/use-restore-pending-like'
import { useProblemStore } from '@/stores/problem-store'

import type { Problem } from '../types/problem-api-types'
import { useToggleProblemLike } from './use-toggle-problem-like'

/**
 * Hook that applies pending problem likes after user authentication.
 */
export function usePendingProblemLike() {
  // We need the toggle like function to apply the like
  const toggleLike = useToggleProblemLike()

  // Access the problem store to find the problem
  const problems = useProblemStore((state) => state.problems)

  // Use the generic restoration hook
  useRestorePendingLike<Problem>({
    storageKey: PENDING_PROBLEM_LIKE_STORAGE_KEY,
    getItem: (problemSlug) => problems[problemSlug],
    shouldExecute: (problem) => !problem.liked,
    onExecute: (problemSlug) => toggleLike(problemSlug),
  })
}
