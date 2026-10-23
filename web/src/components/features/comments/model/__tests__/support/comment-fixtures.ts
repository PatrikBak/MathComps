import type { CommentData } from '../../../components/CommentItem'

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
