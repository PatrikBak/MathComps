import type { CommentData } from '../../../components/CommentItem'
import type { CommentDto } from '../../../services/comment-api-types'

/**
 * A comment as the comment components draw it.
 *
 * @param id - The comment's id.
 * @param authorId - Who posted the comment.
 * @param postedAt - When the comment was posted.
 * @param replies - The comment's replies.
 *
 * @returns The comment, standing and unedited.
 */
export function comment(
  id: string,
  authorId: string,
  postedAt: string,
  replies: CommentData[] = []
): CommentData {
  // A standing comment with no reactions
  return {
    id,
    authorId,
    author: authorId,
    avatarUrl: null,
    content: id,
    timestamp: new Date(postedAt),
    editedAt: null,
    reactions: [],
    viewerReaction: null,
    isDeleted: false,
    replies,
  }
}

/**
 * A comment Zuzana posted on a given day of October 2026, as the server sends it.
 *
 * @param id - The comment's id, which is also what it says unless told otherwise.
 * @param day - The day it was posted.
 * @param replies - Its replies.
 * @param content - What it says.
 *
 * @returns The comment, standing and unedited, with no reactions.
 */
export function commentDto(
  id: string,
  day: number,
  replies: CommentDto[] = [],
  content = id
): CommentDto {
  // The comment, as posted
  return {
    id,
    author: { id: 'user_zuzana', name: 'Zuzana', avatarUrl: null },
    content,
    createdAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
    editedAt: null,
    isDeleted: false,
    reactions: [],
    replies,
  }
}
