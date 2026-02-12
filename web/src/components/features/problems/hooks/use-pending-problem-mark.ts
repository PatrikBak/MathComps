import { PENDING_PROBLEM_MARK_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useRestorePendingAction } from '@/hooks/use-restore-pending-action'
import { useProblemStore } from '@/stores/problem-store'

import type { Problem } from '../types/problem-api-types'
import { useToggleProblemMark } from './use-toggle-problem-mark'

/**
 * Hook that applies pending problem marks after user authentication.
 */
export function usePendingProblemMark() {
  // We need the toggle mark function to apply the mark
  const toggleMark = useToggleProblemMark()

  // Access the problem store to find the problem
  const problems = useProblemStore((state) => state.problems)

  // Use the generic restoration hook
  useRestorePendingAction<Problem>({
    storageKey: PENDING_PROBLEM_MARK_STORAGE_KEY,
    getItem: (problemSlug) => problems[problemSlug],
    shouldExecute: (problem) => !problem.marked,
    onExecute: (problemSlug) => toggleMark(problemSlug),
  })
}
