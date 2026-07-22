import type { CommentData } from '../components/CommentItem'
import type { CommentDto } from '../services/comment-api-types'

/**
 * A recursive structure with optional nested replies.
 */
type CommentWithReplies = {
  /** The comment's replies, if any. */
  replies?: CommentWithReplies[]
  /** Whether the comment has been soft-deleted. */
  isDeleted: boolean
}

/**
 * Determines if a comment should be hidden from rendering.
 *
 * A comment should be hidden if and only if:
 * 1. The comment itself is deleted, AND
 * 2. All of its children (recursively) are also hidden.
 *
 * This means deleted comments with visible descendants should still
 * be rendered (showing "[Komentár bol zmazaný]") to preserve the thread structure.
 *
 * @param comment - The comment to check.
 *
 * @returns `true` if the comment should be hidden, `false` otherwise.
 */
export function shouldHideComment(comment: CommentWithReplies): boolean {
  // Non-deleted comments are never hidden
  if (!comment.isDeleted) {
    return false
  }

  // Deleted comments with no replies should be hidden
  if (comment.replies?.length === 0) {
    return true
  }

  // Deleted comments are hidden only if ALL children are also hidden
  return comment.replies?.every(shouldHideComment) ?? false
}

/**
 * Recursively counts all non-deleted comments including nested replies.
 *
 * @param comments - The array of comments to count.
 *
 * @returns The total number of non-deleted comments.
 */
export function countAllComments(comments: CommentWithReplies[]): number {
  return comments.reduce((currentCount, comment) => {
    return currentCount + (comment.isDeleted ? 0 : 1) + countAllComments(comment.replies || [])
  }, 0)
}

/**
 * Converts API CommentDto to the UI's {@link CommentData} format.
 *
 * @param dto - The API CommentDto to convert.
 *
 * @returns The converted {@link CommentData}.
 */
export function convertToCommentData(dto: CommentDto): CommentData {
  return {
    id: dto.id,
    authorId: dto.author.id,
    author: dto.author.name,
    avatarUrl: dto.author.avatarUrl,
    content: dto.content,
    timestamp: new Date(dto.createdAt),
    editedAt: dto.editedAt ? new Date(dto.editedAt) : undefined,
    likes: dto.likeCount,
    isLiked: dto.isLiked,
    isDeleted: dto.isDeleted,
    replies: dto.replies.map(convertToCommentData),
  }
}

/**
 * Recursively adds a reply to a comment in the tree.
 *
 * @param comments - The current comments array.
 * @param parentId - The ID of the parent comment.
 * @param newReply - The new reply to add.
 * @returns The updated comments array.
 */
export function addReplyToComment(
  comments: CommentDto[],
  parentId: string,
  newReply: CommentDto
): CommentDto[] {
  // We will recreate each comment
  return comments.map((comment) => {
    // If we found the right parent comment, append the reply
    if (comment.id === parentId) {
      return {
        ...comment,
        replies: [...comment.replies, newReply],
      }
    }

    // If the comment has any replies, we need to recurse down to find the right parent
    if (comment.replies.length > 0) {
      return {
        ...comment,
        replies: addReplyToComment(comment.replies, parentId, newReply),
      }
    }

    // Here the comment has no replies and it is not the parent we are looking for
    return comment
  })
}

/**
 * Recursively updates a comment in the tree.
 *
 * @param comments - The current comments array.
 * @param commentId - The ID of the comment to update.
 * @param updates - The updates to apply. Can include a function for `likeCount`.
 * @returns The updated comments array.
 */
export function updateCommentInTree(
  comments: CommentDto[],
  commentId: string,
  updates: Partial<Omit<CommentDto, 'likeCount'>> & {
    likeCount?: number | ((comment: CommentDto) => number)
  }
): CommentDto[] {
  // We will recreate each comment
  return comments.map((comment) => {
    // If we found the right comment...
    if (comment.id === commentId) {
      // Figure out the like count
      const likeCount =
        // If we have been passed a like count function
        typeof updates.likeCount === 'function'
          ? // Use it
            updates.likeCount(comment)
          : // Otherwise use the passed value or the existing value
            (updates.likeCount ?? comment.likeCount)

      // Return updated comment
      return {
        ...comment,
        ...updates,
        likeCount,
      }
    }

    // If the comment has any replies, we need to recurse down to find the right parent
    if (comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, updates),
      }
    }

    // Here the comment has no replies and it is not the parent we are looking for
    return comment
  })
}

/**
 * Recursively finds a comment in the tree.
 *
 * @param comments - The comments array.
 * @param commentId - The ID of the comment to find.
 *
 * @returns The found comment or undefined if not found.
 */
export const findCommentInTree = (
  comments: CommentData[],
  commentId: string
): CommentData | undefined => {
  // Go through each comment
  for (const comment of comments) {
    // If we found the right comment, return it
    if (comment.id === commentId) return comment

    // If the comment has any replies...
    if (comment.replies && comment.replies.length > 0) {
      // Recurse down to find the right parent
      const found = findCommentInTree(comment.replies, commentId)

      // If we found it among the replies, return it
      if (found) return found
    }
  }

  // If we didn't find it, return undefined
  return undefined
}
