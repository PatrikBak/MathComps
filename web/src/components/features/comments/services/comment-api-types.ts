/**
 * The type of content that can be commented on.
 */
export type CommentTargetType = 'Handout' | 'Problem' | 'News'

/**
 * The target that a comment is / will be made on.
 */
export type CommentTarget = {
  /** The type of target (Handout, Problem, or News). */
  targetType: CommentTargetType
  /** Permanent identifier of the target (nanoid for handouts/news, slug for problems). */
  targetId: string
}

/**
 * Author information for a comment.
 */
type CommentAuthorDto = {
  /** Unique identifier for the author. */
  id: string
  /** The author's username, or null when they have chosen none or their account is deleted. */
  name: string | null
  /** Optional URL to the author's avatar image. */
  avatarUrl: string | null
}

/**
 * A single comment with nested replies.
 */
export type CommentDto = {
  /** Unique identifier for the comment. */
  id: string
  /** The comment's author data. */
  author: CommentAuthorDto
  /** The markdown content of the comment. */
  content: string
  /** When the comment was created (ISO 8601 string). */
  createdAt: string
  /** When the comment was last edited, if applicable (ISO 8601 string). */
  editedAt: string | null
  /** Whether the comment has been soft-deleted. */
  isDeleted: boolean
  /** Total number of likes on this comment. */
  likeCount: number
  /** Whether the viewing user has liked this comment. False if no user. */
  isLiked: boolean
  /** Nested reply comments (recursive). */
  replies: CommentDto[]
}

/**
 * Result returned after updating a comment.
 */
export type UpdateCommentResult = {
  /** The ID of the newly created comment version. */
  id: string
  /** The timestamp when the edit was made (ISO 8601 string). */
  editedAt: string
}
