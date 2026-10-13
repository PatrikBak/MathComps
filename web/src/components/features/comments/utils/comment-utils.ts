import type { CommentData } from '../components/CommentItem'
import type { CommentDto, CommentReactionDto } from '../services/comment-api-types'

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
 * @param viewerId - The reader's id with the sign-in provider, or null when nobody is signed in.
 *
 * @returns The converted {@link CommentData}.
 */
export function convertToCommentData(dto: CommentDto, viewerId: string | null): CommentData {
  // The comment in the UI's shape, with the reader's own reaction picked out and the replies converted alike
  return {
    id: dto.id,
    authorId: dto.author.id,
    author: dto.author.name,
    avatarUrl: dto.author.avatarUrl,
    content: dto.content,
    timestamp: new Date(dto.createdAt),
    editedAt: dto.editedAt ? new Date(dto.editedAt) : null,
    reactions: dto.reactions,
    viewerReaction: dto.reactions.find((reaction) => reaction.userId === viewerId)?.kind ?? null,
    isDeleted: dto.isDeleted,
    replies: dto.replies.map((reply) => convertToCommentData(reply, viewerId)),
  }
}

/**
 * Applies a press of a reaction to a comment's reactions. Nobody holds more than one, so pressing the one the
 * presser holds takes it back, and pressing any other swaps to it.
 *
 * @param reactions - The comment's reactions, oldest first.
 * @param press - The reaction pressed, signed by who pressed it.
 *
 * @returns The comment's reactions after the press, oldest first.
 */
export function pressReaction(
  reactions: CommentReactionDto[],
  press: CommentReactionDto
): CommentReactionDto[] {
  // The presser's reaction before the press, if they held one
  const held = reactions.find((reaction) => reaction.userId === press.userId)

  // Everybody else's reactions, which the press leaves alone
  const others = reactions.filter((reaction) => reaction.userId !== press.userId)

  // The held one pressed again is taken back, any other press lands as the newest
  return held?.kind === press.kind ? others : [...others, press]
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
 * Changes to one comment of a thread: each field replaced as given, the reactions through a function of the current
 * ones.
 */
type CommentUpdates = Partial<Omit<CommentDto, 'reactions'>> & {
  /** A function turning the comment's current reactions into the new ones. */
  reactions?: (reactions: CommentReactionDto[]) => CommentReactionDto[]
}

/**
 * Recursively updates a comment in the tree.
 *
 * @param comments - The current comments array.
 * @param commentId - The ID of the comment to update.
 * @param updates - The updates to apply.
 * @returns The updated comments array.
 */
export function updateCommentInTree(
  comments: CommentDto[],
  commentId: string,
  updates: CommentUpdates
): CommentDto[] {
  // We will recreate each comment
  return comments.map((comment) => {
    // If we found the right comment...
    if (comment.id === commentId) {
      // The comment's reactions, through the update when one is given
      const reactions = updates.reactions ? updates.reactions(comment.reactions) : comment.reactions

      // Return updated comment
      return {
        ...comment,
        ...updates,
        reactions,
      }
    }

    // If the comment has any replies, we need to recurse down to find the right comment
    if (comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentInTree(comment.replies, commentId, updates),
      }
    }

    // Here the comment has no replies and it is not the one we are looking for
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
    if (comment.replies.length > 0) {
      // Recurse down to find the right parent
      const found = findCommentInTree(comment.replies, commentId)

      // If we found it among the replies, return it
      if (found) return found
    }
  }

  // If we didn't find it, return undefined
  return undefined
}
