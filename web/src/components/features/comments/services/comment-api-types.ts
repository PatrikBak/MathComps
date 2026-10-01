/**
 * The kind of target a comment thread belongs to.
 */
export type CommentTargetType = 'Handout' | 'Problem' | 'News' | 'HostedGrade'

/**
 * What a comment thread hangs off: the kind of thing, and which one.
 */
export type CommentTarget = {
  /** The type of target. */
  targetType: CommentTargetType
  /**
   * Permanent identifier of the target: a nanoid for handouts and news, a slug for problems, and
   * `{problemId}:{userId}` for one student's grade on one problem.
   */
  targetId: string
}

/**
 * Author information for a comment.
 */
type CommentAuthorDto = {
  /** The author's id with the sign-in provider. */
  id: string
  /** The author's username, or null when they have chosen none or their account is deleted. */
  name: string | null
  /** URL to the author's avatar image, or null when they have none. */
  avatarUrl: string | null
}

/**
 * A single comment with nested replies.
 */
export type CommentDto = {
  /** The id of the comment's current version; an edit gives it a new one. */
  id: string
  /** The comment's author. */
  author: CommentAuthorDto
  /** The comment's markdown, empty once it is deleted. */
  content: string
  /** When the comment was created (ISO 8601 string). */
  createdAt: string
  /** When the comment was last edited (ISO 8601 string), or null if never. */
  editedAt: string | null
  /** Whether the comment was deleted; a deleted one keeps its place in the thread. */
  isDeleted: boolean
  /** Total number of likes on this comment. */
  likeCount: number
  /** Whether the viewing user has liked this comment. False for a signed-out viewer. */
  isLiked: boolean
  /** The comment's replies. */
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
