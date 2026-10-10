import { COMMENT_DRAFT_STORAGE_PREFIX } from '@/constants/local-storage-constants'

import type { CommentTarget } from '../services/comment-api-types'

/**
 * Names where, under {@link COMMENT_DRAFT_STORAGE_PREFIX}, a comment written but not yet sent is kept: one for a new
 * comment in each thread, and one for each comment being replied to. Keyed by the reader on top of that, a browser
 * being a thing people share.
 *
 * @param readerId - The signed-in reader, or null for a visitor, who has nothing to keep.
 * @param target - The thread the comment goes into.
 * @param parentCommentId - The comment being replied to, or null for a new comment.
 *
 * @returns The storage key, or null where nothing is kept.
 */
export function commentDraftStorageKey(
  readerId: string | null,
  target: CommentTarget,
  parentCommentId: string | null
): string | null {
  // A visitor writes no comment
  if (readerId === null) return null

  // The reader, and the thread they write into
  const threadKey = [COMMENT_DRAFT_STORAGE_PREFIX, readerId, target.targetType, target.targetId]

  // A new comment's draft, or one reply's
  return (parentCommentId === null ? threadKey : [...threadKey, 'reply', parentCommentId]).join(':')
}
