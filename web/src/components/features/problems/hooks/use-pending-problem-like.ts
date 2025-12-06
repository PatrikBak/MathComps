import { useLocalStorage } from '@mantine/hooks'
import { useEffect } from 'react'

import { PENDING_PROBLEM_LIKE_STORAGE_KEY } from '@/constants/local-storage-constants'
import { useApi } from '@/hooks/useApi'
import { useProblemStore } from '@/stores/problem-store'

import { useToggleProblemLike } from './use-toggle-problem-like'

/**
 * Hook that applies pending problem likes after user authentication.
 *
 * When a non-logged-in user tries to like a problem, the slug is stored in local storage.
 * This hook checks for that pending like after the user logs in and automatically applies it.
 *
 * Important: Only applies the like if the problem is NOT already liked, to avoid
 * accidentally unliking a problem that the user manually liked after logging in.
 */
export function usePendingProblemLike() {
  // We need the API client to check if it's ready to make the like call
  const api = useApi()

  // We need the toggle like function to apply the like
  const toggleLike = useToggleProblemLike()

  // We need to access the pending like slug from local storage
  const [pendingLikeSlug, setPendingLikeSlug] = useLocalStorage<string | null>({
    key: PENDING_PROBLEM_LIKE_STORAGE_KEY,
    defaultValue: null,
  })

  // Subscribe only to the specific problem we are interested in
  const problem = useProblemStore((state) =>
    pendingLikeSlug ? state.problems[pendingLikeSlug] : undefined
  )

  useEffect(() => {
    // Only proceed if the API client is ready, the problem is ready, and there's a pending like slug
    if (api.state === 'ready' && problem && pendingLikeSlug) {
      // Only apply the like if the problem exists and is NOT already liked
      // This prevents accidentally unliking a problem that the user manually liked
      // after logging in but before this hook runs
      if (!problem.liked) {
        toggleLike(pendingLikeSlug)
      }

      // Always clear the pending like from local storage once we've processed it
      setPendingLikeSlug(null)
    }
  }, [api.state, pendingLikeSlug, toggleLike, setPendingLikeSlug, problem])
}
