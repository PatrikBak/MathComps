import { buildApiUrl } from '@/components/shared/utils/url-utils'

import type { CommentTarget } from './comment-api-types'

/**
 * Builds the API URL for fetching comments.
 *
 * @param target - The target to fetch comments for.
 *
 * @returns The API URL for fetching comments.
 */
export function getCommentsUrl(target: CommentTarget): string {
  const params = new URLSearchParams({
    targetType: target.targetType,
    targetId: target.targetId,
  })
  return buildApiUrl(`/comments?${params.toString()}`)
}

/**
 * Builds the API URL for creating a comment.
 *
 * @returns The API URL for creating a comment.
 */
export function getCreateCommentUrl(): string {
  return buildApiUrl('/comments')
}

/**
 * Builds the API URL for updating a comment.
 *
 * @param commentId - The ID of the comment to update.
 *
 * @returns The API URL for updating a comment.
 */
export function getUpdateCommentUrl(commentId: string): string {
  return buildApiUrl(`/comments/${commentId}`)
}

/**
 * Builds the API URL for deleting a comment.
 *
 * @param commentId - The ID of the comment to delete.
 *
 * @returns The API URL for deleting a comment.
 */
export function getDeleteCommentUrl(commentId: string): string {
  return buildApiUrl(`/comments/${commentId}`)
}

/**
 * Builds the API URL for toggling a comment like.
 *
 * @param commentId - The ID of the comment to toggle like for.
 *
 * @returns The API URL for toggling a comment like.
 */
export function getToggleCommentLikeUrl(commentId: string): string {
  return buildApiUrl(`/comments/${commentId}/like`)
}

/**
 * Builds the API URL for fetching comment counts.
 *
 * @returns The API URL for fetching comment counts.
 */
export function getCommentCountsUrl(): string {
  return buildApiUrl('/comments/counts')
}
