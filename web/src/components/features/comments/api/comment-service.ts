import type { ApiCaller } from '@/hooks/use-api'
import type { ApiResult } from '@/types/api'

import type {
  CommentDto,
  CommentTarget,
  CommentTargetType,
  UpdateCommentResult,
} from './comment-api-types'
import {
  getCommentCountsUrl,
  getCommentsUrl,
  getCreateCommentUrl,
  getDeleteCommentUrl,
  getToggleCommentLikeUrl,
  getUpdateCommentUrl,
} from './comment-api-urls'

/**
 * Fetches threaded comments for a target.
 *
 * @param apiCall - The authenticated API caller function.
 * @param target - The target to fetch comments for.
 *
 * @returns A promise resolving to the comments or an error.
 */
export async function getComments(
  apiCall: ApiCaller,
  target: CommentTarget
): Promise<ApiResult<CommentDto[]>> {
  return apiCall<CommentDto[]>(() => getCommentsUrl(target), {
    method: 'GET',
  })
}

/**
 * Fetches comment counts for multiple targets of the same type.
 *
 * @param apiCall - The authenticated API caller function.
 * @param targetType - The type of targets.
 * @param slugs - Array of target slugs to get counts for.
 *
 * @returns A promise resolving to a slug->count mapping or an error.
 */
export async function getCommentCounts(
  apiCall: ApiCaller,
  targetType: CommentTargetType,
  targetIds: string[]
): Promise<ApiResult<Record<string, number>>> {
  return apiCall<Record<string, number>>(() => getCommentCountsUrl(), {
    method: 'POST',
    body: JSON.stringify({
      targetType,
      targetIds: targetIds,
    }),
  })
}

/**
 * Creates a new comment or reply.
 *
 * @param apiCall - The authenticated API caller function.
 * @param target - The target to create the comment on.
 * @param content - The markdown content of the comment.
 * @param parentCommentId - Optional parent comment ID for replies.
 *
 * @returns A promise resolving to the created comment or an error.
 */
export async function createComment(
  apiCall: ApiCaller,
  target: CommentTarget,
  content: string,
  parentCommentId?: string | null
): Promise<ApiResult<CommentDto>> {
  return apiCall<CommentDto>(() => getCreateCommentUrl(), {
    method: 'POST',
    body: JSON.stringify({
      target,
      content,
      parentCommentId: parentCommentId ?? null,
    }),
  })
}

/**
 * Updates an existing comment's content.
 *
 * @param apiCall - The authenticated API caller function.
 * @param commentId - The ID of the comment to update.
 * @param target - The target the comment belongs to.
 * @param content - The new markdown content.
 * @returns A promise resolving to the new comment ID and editedAt timestamp, or an error.
 */
export async function updateComment(
  apiCall: ApiCaller,
  commentId: string,
  target: CommentTarget,
  content: string
): Promise<ApiResult<UpdateCommentResult>> {
  return apiCall<UpdateCommentResult>(() => getUpdateCommentUrl(commentId), {
    method: 'PUT',
    body: JSON.stringify({
      target,
      content,
    }),
  })
}

/**
 * Soft-deletes a comment.
 *
 * @param apiCall - The authenticated API caller function.
 * @param commentId - The ID of the comment to delete.
 * @returns A promise resolving to success or an error.
 */
export async function deleteComment(
  apiCall: ApiCaller,
  commentId: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getDeleteCommentUrl(commentId), {
    method: 'DELETE',
  })
}

/**
 * Toggles a like on a comment.
 *
 * @param apiCall - The authenticated API caller function.
 * @param commentId - The ID of the comment to like/unlike.
 * @returns A promise resolving to success or an error.
 */
export async function toggleCommentLike(
  apiCall: ApiCaller,
  commentId: string
): Promise<ApiResult<void>> {
  return apiCall<void>(() => getToggleCommentLikeUrl(commentId), {
    method: 'POST',
  })
}
