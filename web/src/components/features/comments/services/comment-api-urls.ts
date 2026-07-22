import { buildApiUrl } from '@/components/shared/utils/url-utils'

import type { CommentTarget } from './comment-api-types'

/**
 * The base path for the comments endpoints.
 */
const COMMENTS_PATH = '/comments'

/**
 * Builds the API URL for fetching comments.
 *
 * @param target - The target to fetch comments for.
 *
 * @returns The API URL for fetching comments.
 */
export function getCommentsUrl(target: CommentTarget): string {
  return buildApiUrl(COMMENTS_PATH, {
    targetType: target.targetType,
    targetId: target.targetId,
  })
}

/**
 * Builds the API URL for creating a comment.
 *
 * @returns The API URL for creating a comment.
 */
export function getCreateCommentUrl(): string {
  return buildApiUrl(COMMENTS_PATH)
}

/**
 * Builds the API URL for updating a comment.
 *
 * @param commentId - The ID of the comment to update.
 *
 * @returns The API URL for updating a comment.
 */
export function getUpdateCommentUrl(commentId: string): string {
  return buildApiUrl(`${COMMENTS_PATH}/${encodeURIComponent(commentId)}`)
}

/**
 * Builds the API URL for deleting a comment.
 *
 * @param commentId - The ID of the comment to delete.
 *
 * @returns The API URL for deleting a comment.
 */
export function getDeleteCommentUrl(commentId: string): string {
  return buildApiUrl(`${COMMENTS_PATH}/${encodeURIComponent(commentId)}`)
}

/**
 * Builds the API URL for toggling a comment like.
 *
 * @param commentId - The ID of the comment to toggle like for.
 *
 * @returns The API URL for toggling a comment like.
 */
export function getToggleCommentLikeUrl(commentId: string): string {
  return buildApiUrl(`${COMMENTS_PATH}/${encodeURIComponent(commentId)}/like`)
}

/**
 * Builds the API URL for fetching comment counts.
 *
 * @returns The API URL for fetching comment counts.
 */
export function getCommentCountsUrl(): string {
  return buildApiUrl(`${COMMENTS_PATH}/counts`)
}
