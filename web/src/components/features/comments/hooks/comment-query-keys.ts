import type { CommentTarget, CommentTargetType } from '../services/comment-api-types'

/**
 * Query keys for comment-related queries.
 */
export const commentQueryKeys = {
  /** Base key for all comment queries. */
  all: ['comments'] as const,

  /**
   * Query key for comments on a specific target.
   * Includes the user's id so cache is invalidated when user logs in/out
   * (since whether they liked a comment is user-specific).
   */
  target: (target: CommentTarget, userId: string | null) =>
    [...commentQueryKeys.all, target.targetType, target.targetId, userId] as const,
}

/**
 * Query keys for comment count queries.
 */
export const commentCountQueryKeys = {
  /** The base for all queries */
  all: ['commentCounts'] as const,

  /** Query key for a specific target type */
  forType: (targetType: CommentTargetType) => [...commentCountQueryKeys.all, targetType] as const,

  /**
   * Query key for a specific target type and target IDs. Sorted so that the same set asked for in two orders
   * keys as one query, and over a copy so the caller's own array keeps the order they built it in.
   */
  forTargetIds: (targetType: CommentTargetType, targetIds: readonly string[]) =>
    [...commentCountQueryKeys.forType(targetType), [...targetIds].sort().join(',')] as const,
}
