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

/**
 * Moves the draft of a reply to a comment's new version, which an edit saves under a new id.
 *
 * @param readerId - The signed-in reader, or null for a visitor, who has nothing kept.
 * @param target - The thread the comment is in.
 * @param fromId - The comment's id before the edit.
 * @param toId - The comment's id after the edit.
 */
export function moveReplyDraft(
  readerId: string | null,
  target: CommentTarget,
  fromId: string,
  toId: string
): void {
  // Where the draft is kept now, and where it goes
  const from = commentDraftStorageKey(readerId, target, fromId)
  const to = commentDraftStorageKey(readerId, target, toId)

  // A visitor keeps no draft
  if (from === null || to === null) return

  // A browser can refuse storage outright, and a draft is not worth failing an edit over
  try {
    // The draft, if any was written
    const draft = window.localStorage.getItem(from)

    // Nothing written, nothing to move
    if (draft === null) return

    // Keep the draft under the new version
    window.localStorage.setItem(to, draft)

    // Drop the draft from under the old version
    window.localStorage.removeItem(from)
  } catch {
    // Storage refused, so the draft stays where it was
  }
}
