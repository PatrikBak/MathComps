import { useAuth } from '@clerk/nextjs'

import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { CommentDto, CommentTarget } from '../services/comment-api-types'
import { getComments } from '../services/comment-service'
import { commentQueryKeys } from './comment-query-keys'

/**
 * What {@link useFetchComments} hands back.
 */
type UseFetchCommentsResult = {
  /** The thread as it stands, empty until it has been read. */
  comments: CommentDto[]
  /** How far the read got, for whatever stands in the thread's place. */
  uiState: QueryUiState
}

/**
 * Reads one target's comment thread.
 *
 * Who is asking rides in the key, because a signed-in reader's own copy says which comments they have
 * liked.
 *
 * @param target - What the thread hangs off.
 *
 * @returns The thread and the state of the read.
 */
export function useFetchComments(target: CommentTarget): UseFetchCommentsResult {
  // Whose reading of the thread this is, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Who is asking, held under nobody until Clerk has settled who that is
  const readerId = isUserLoaded ? (userId ?? null) : null

  // The thread itself
  const { data: comments, uiState } = useApiQuery({
    queryKey: commentQueryKeys.target(target, readerId),
    fetch: (apiCall) => getComments(apiCall, target),
    // A thread reads the same to a visitor with no account
    requireAuth: false,
    // Only read once the key's reader is settled, or the thread lands under the wrong one
    enabled: isUserLoaded,
    // A reply posted elsewhere should show up here promptly
    ...cachePolicy.userData,
  })

  // The thread and the state of the read
  return { comments: comments ?? [], uiState }
}
