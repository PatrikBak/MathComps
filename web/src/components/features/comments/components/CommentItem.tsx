'use client'

import { ChevronDown, Heart, Minus, Pencil, Reply, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useCallback, useState } from 'react'

import { MAX_CHARACTERS_PER_COMMENT } from '@/components/features/comments/model/comment-limits'
import { UserAvatarImage } from '@/components/layout/UserAvatarImage'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'

/** Size of comment avatars in pixels */
const AVATAR_SIZE = 28

/**
 * Data representing a single comment.
 */
export type CommentData = {
  /** The id of the comment's current version. */
  id: string
  /** The author's id with the sign-in provider. */
  authorId: string
  /** The author's username, or null when they have chosen none or their account is deleted. */
  author: string | null
  /** URL of the author's avatar image, or null when they have none. */
  avatarUrl: string | null
  /** The markdown-formatted text content of the comment. */
  content: string
  /** The date and time when the comment was originally posted. */
  timestamp: Date
  /** The date and time when the comment was last edited, or null when it never was. */
  editedAt: Date | null
  /** The total number of likes this comment has received. */
  likes: number
  /** Whether the currently authenticated user has liked this comment. */
  isLiked: boolean
  /** Whether the comment has been deleted. */
  isDeleted: boolean
  /** The comment's replies. */
  replies: CommentData[]
}

/**
 * Props for the {@link CommentItem} presentation component.
 */
type CommentItemProps = Omit<CommentData, 'id' | 'authorId' | 'replies'> & {
  /** Whether the comment shows its likes. */
  showLikes: boolean
  /** Whether the comment's replies are collapsed. */
  isCollapsed: boolean
  /** Number of replies beneath the comment at any depth, deleted ones not counted. */
  replyCount: number
  /** A function which collapses or expands the comment's replies. */
  onToggleCollapse: () => void
  /** A function which opens a reply to the comment, absent when replying isn't offered. */
  onReply?: () => void
  /** A function which toggles the viewer's like, absent when the comment can't be liked. */
  onLike?: () => void
  /** A function which saves the comment's new content, absent when it can't be edited. */
  onEdit?: (newContent: string) => Promise<void>
  /** A function which deletes the comment, absent when it can't be deleted. */
  onDelete?: () => void
  /** The editor for a reply to the comment, while one is open beneath it. */
  replyInputNode?: React.ReactNode
  /** The comment's rendered replies. */
  repliesNode: React.ReactNode
}

/**
 * A comment in a thread, editable in place, with its replies collapsible beneath it.
 */
export function CommentItem({
  author,
  avatarUrl,
  content,
  timestamp,
  editedAt,
  likes,
  isLiked,
  isDeleted,
  showLikes,
  isCollapsed,
  replyCount,
  onToggleCollapse,
  onReply,
  onLike,
  onEdit,
  onDelete,
  replyInputNode,
  repliesNode,
}: CommentItemProps) {
  // Whether the comment is currently being edited
  const [isEditing, setIsEditing] = useState(false)

  // Whether the edited text is being saved
  const [isSaving, setIsSaving] = useState(false)

  // The current content of the comment being edited
  const [editText, setEditText] = useState(content)

  // Whether the delete confirmation dialog is open
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Whether the line connecting the comment to its replies is hovered over
  const [isLineHovered, setIsLineHovered] = useState(false)

  // Plural copy
  const tPlurals = useTranslations('plurals')

  // Comment copy
  const tComments = useTranslations('comments')

  // Profile copy
  const tProfile = useTranslations('profile')

  // Date formatter
  const format = useFormatter()

  // The author's username, or the default user's name when they have none
  const authorName = author ?? tProfile('defaultUser')

  // Whether the comment's replies are showing
  const areRepliesShown = replyCount > 0 && !isCollapsed

  // A function which formats a comment time, giving the year only outside the current one
  const formatCommentTime = (date: Date) =>
    format.dateTime(date, {
      day: 'numeric',
      month: 'numeric',
      year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  // A function which collapses or expands the comment's replies
  const handleToggleCollapse = () => {
    // Clear the line's hover, which the line can't clear itself once it unmounts under the pointer
    setIsLineHovered(false)

    // Collapse or expand the replies
    onToggleCollapse()
  }

  // A function which saves the edited text
  const handleEditSubmit = useCallback(async () => {
    // Only a non-empty edit is saved, and only where the comment can be edited
    if (!editText.trim() || !onEdit) return

    // Save the edit, staying in edit mode when it fails
    try {
      // Start saving
      setIsSaving(true)

      // Save the trimmed text
      await onEdit(editText.trim())

      // Leave edit mode once saved
      setIsEditing(false)
    } catch {
      // Stay in edit mode so the text can be resubmitted; reporting the failure is the handler's
    } finally {
      // Mark the save as over
      setIsSaving(false)
    }
  }, [editText, onEdit])

  // A function which abandons the edit
  const handleEditCancel = useCallback(() => {
    // Leave edit mode
    setIsEditing(false)
  }, [])

  // A function which opens the editor on the comment's content
  const handleEditStart = useCallback(() => {
    // Enter edit mode
    setIsEditing(true)

    // Start from the comment as it stands
    setEditText(content)
  }, [content])

  return (
    <div className="relative">
      {/* Line spanning the comment thread */}
      {areRepliesShown && (
        <div
          className={cn(
            'absolute transition-colors cursor-pointer',
            isLineHovered ? 'bg-focus' : 'bg-foreground/10'
          )}
          style={{
            left: `${AVATAR_SIZE / 2 - 8}px`,
            top: `${AVATAR_SIZE + 10}px`,
            bottom: '0px',
            width: '16px',
            paddingLeft: '7.5px',
            paddingRight: '7.5px',
            backgroundClip: 'content-box',
          }}
          onClick={handleToggleCollapse}
          onMouseEnter={() => setIsLineHovered(true)}
          onMouseLeave={() => setIsLineHovered(false)}
        />
      )}

      {/* Collapse button on the line, hidden until hover */}
      {areRepliesShown && (
        <button
          className={cn(
            'absolute flex items-center justify-center w-5 h-5 rounded-full border-2 z-20 transition-all duration-150',
            isLineHovered
              ? 'opacity-100 bg-focus border-focus text-focus-foreground'
              : 'opacity-0 bg-surface border-foreground/10 text-muted hover:opacity-100 hover:border-focus hover:text-focus'
          )}
          style={{
            left: `${AVATAR_SIZE / 2 - 10}px`,
            top: `calc(50% + 10px)`,
          }}
          onClick={handleToggleCollapse}
          onMouseEnter={() => setIsLineHovered(true)}
          onMouseLeave={() => setIsLineHovered(false)}
          title={tComments('hideReplies')}
        >
          <Minus size={10} strokeWidth={3} />
        </button>
      )}

      {/* Comment row: Avatar + Body */}
      <div className="flex gap-3 pt-2">
        {/* Avatar */}
        <div className="flex-shrink-0 z-10">
          <UserAvatarImage
            imageUrl={avatarUrl}
            altText={tComments('avatarAlt', { author: authorName })}
            size={AVATAR_SIZE}
          />
        </div>

        {/* Comment body */}
        <div className="flex-1 min-w-0">
          {/* Header, dropping the actions to a new line before splitting the name from the time */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
            {/* Author and time */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {/* Author */}
              <span className="text-sm font-medium text-foreground">{authorName}</span>

              {/* Time and edited mark */}
              <span className="text-xs text-muted flex items-center gap-1">
                {formatCommentTime(timestamp)}
                {editedAt && !isDeleted && (
                  <Tooltip
                    placement="top"
                    content={tComments('lastEdited', { date: formatCommentTime(editedAt) })}
                  >
                    <span className="ml-1 cursor-help opacity-80 hover:opacity-100 italic">
                      {tComments('edited')}
                    </span>
                  </Tooltip>
                )}
              </span>
            </div>

            {/* Actions, wrapping as one unit */}
            {!isEditing && !isDeleted && (
              <div className="flex items-center gap-3">
                {/* Likes */}
                {showLikes &&
                  (onLike ? (
                    // A button where the comment can be liked
                    <button
                      onClick={onLike}
                      className={cn(
                        'flex items-center gap-1 text-xs transition-colors',
                        isLiked ? 'text-error' : 'text-muted hover:text-foreground'
                      )}
                      title={tComments('like')}
                    >
                      <Heart size={14} className={cn(isLiked && 'fill-current')} />
                      <span>{likes}</span>
                    </button>
                  ) : (
                    // A plain count otherwise
                    <div
                      className={cn(
                        'flex items-center gap-1 text-xs cursor-default',
                        isLiked ? 'text-error' : 'text-muted'
                      )}
                    >
                      <Heart size={14} className={cn(isLiked && 'fill-current')} />
                      <span>{likes}</span>
                    </div>
                  ))}

                {/* Reply button */}
                {onReply && (
                  <button
                    onClick={onReply}
                    className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                    title={tComments('reply')}
                  >
                    <Reply size={14} />
                  </button>
                )}

                {/* Edit button */}
                {onEdit && (
                  <button
                    onClick={handleEditStart}
                    className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                    title={tComments('edit')}
                  >
                    <Pencil size={14} />
                  </button>
                )}

                {/* Delete button */}
                {onDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-error"
                    title={tComments('delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            // The editor while editing
            <div className="mb-2">
              <RichMathEditor
                maxCharacters={MAX_CHARACTERS_PER_COMMENT}
                value={editText}
                onChange={setEditText}
                placeholder={tComments('editPlaceholder')}
                autoFocus
                onSend={handleEditSubmit}
                onCancel={handleEditCancel}
                isLoading={isSaving}
              />
            </div>
          ) : isDeleted ? (
            // The deleted mark for a deleted comment
            <div className="text-sm text-muted italic mb-1.5">[{tComments('deleted')}]</div>
          ) : (
            // The comment's content otherwise
            <div className="text-sm text-muted-foreground leading-relaxed mb-1.5">
              <RichMathEditorRenderer content={content} imageContext="userUploads" />
            </div>
          )}
        </div>
      </div>

      {/* Comment replies */}
      {(replyCount > 0 || replyInputNode) && (
        <div
          className="relative"
          style={{
            marginLeft: `${AVATAR_SIZE / 2 + 20}px`,
            paddingTop: areRepliesShown ? '8px' : '0',
            paddingBottom: areRepliesShown ? '8px' : '0',
          }}
        >
          {/* While collapsed, a button saying how many replies are hidden */}
          {replyCount > 0 && isCollapsed ? (
            <button
              onClick={handleToggleCollapse}
              className="flex items-center gap-1.5 py-2 text-xs text-link hover:text-link-hover transition-colors"
            >
              <ChevronDown size={14} />
              <span>
                {tComments('show')} {tPlurals('replies', { count: replyCount })}
              </span>
            </button>
          ) : (
            // Otherwise the replies
            repliesNode
          )}

          {/* Reply editor */}
          {replyInputNode && <div className="pt-4 pb-2">{replyInputNode}</div>}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {onDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={onDelete}
          title={tComments('deleteComment')}
          message={tComments('deleteConfirmMessage')}
          confirmText={tComments('delete')}
          cancelText={tComments('cancelDelete')}
          variant="danger"
        />
      )}
    </div>
  )
}
