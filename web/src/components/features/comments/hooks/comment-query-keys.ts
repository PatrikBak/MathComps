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
   * (since whether a thread can be read at all is decided per reader).
   */
  target: (target: CommentTarget, userId: string | null) =>
    [...commentQueryKeys.all, target.targetType, target.targetId, userId] as const,
}

/**
 * Mutation keys for writes to comments, every one under {@link commentMutationKeys.all}, so whether any write to a
 * comment is out can be asked apart from writes to anything else.
 */
export const commentMutationKeys = {
  /** The prefix of every write to a comment. */
  all: ['commentWrites'] as const,

  /** A new comment or reply. */
  creates: () => [...commentMutationKeys.all, 'create'] as const,

  /** Every reaction pressed in one thread. */
  reactions: (target: CommentTarget) =>
    [...commentMutationKeys.all, 'reaction', target.targetType, target.targetId] as const,
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
