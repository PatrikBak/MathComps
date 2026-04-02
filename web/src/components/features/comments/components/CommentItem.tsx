'use client'

import { ChevronDown, Heart, Minus, Pencil, Reply, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import React, { useCallback, useEffect, useState } from 'react'

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
  /** Unique identifier for the comment. */
  id: string
  /** Unique identifier for the author (used for ownership checks). */
  authorId: string
  /** The name or username of the person who wrote the comment. */
  author: string
  /** URL of the author's avatar image. */
  avatarUrl?: string | null
  /** The markdown-formatted text content of the comment. */
  content: string
  /** The date and time when the comment was originally posted. */
  timestamp: Date
  /** The date and time when the comment was last edited, if applicable. */
  editedAt?: Date
  /** The total number of likes this comment has received. */
  likes: number
  /** Whether the currently authenticated user has liked this comment. */
  isLiked: boolean
  /** Soft-delete flag - if true, shows that it was deleted instead of content. */
  isDeleted: boolean
  /** List of replies to this comment (nested comments). */
  replies?: CommentData[]
}

/**
 * Props for the {@link CommentItem} presentation component.
 */
type CommentItemProps = Omit<CommentData, 'id' | 'replies'> & {
  /** Whether this comment's replies are collapsed */
  isCollapsed: boolean
  /** Number of nested replies (for "Show X replies" text) */
  replyCount: number
  /** Called when collapse/expand button is clicked */
  onToggleCollapse: () => void
  /** Called when reply button is clicked (only provided for not-deleted comments) */
  onReply?: () => void
  /** Called when like button is clicked */
  onLike?: () => void
  /** Called when edit is submitted (only provided for own comments) */
  onEdit?: (newContent: string) => void | Promise<void>
  /** Called when delete is clicked (only provided for own comments) */
  onDelete?: () => void | Promise<void>
  /** The component handling reply input (only provided for not-deleted comments) */
  replyInputNode?: React.ReactNode
  /** The recursively rendered replies (should they exist) */
  repliesNode?: React.ReactNode
}

/**
 * A single comment item with replies threading.
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
  // Whether the comment is currently being saved (edit mode)
  const [isSaving, setIsSaving] = useState(false)
  // The current content of the comment being edited
  const [editText, setEditText] = useState(content)
  // Whether the delete confirmation dialog is open
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // Whether the line connecting the comment to its replies is hovered over
  const [isLineHovered, setIsLineHovered] = useState(false)

  // Translations for plurals and UI text
  const tPlurals = useTranslations('plurals')
  const tComments = useTranslations('comments')

  // Date formatter (uses current locale automatically)
  const format = useFormatter()

  // Reset hover state when expanding
  useEffect(() => {
    setIsLineHovered(false)
  }, [isCollapsed])

  /**
   * Handles submitting the edit action.
   */
  const handleEditSubmit = useCallback(async () => {
    // Only submit non-empty edits and if an edit handler is provided
    if (!editText.trim() || !onEdit) return

    try {
      // Start saving
      setIsSaving(true)

      // Resolve the edit action
      const result = onEdit(editText.trim())

      // If it returns a promise, wait for it to resolve
      if (result instanceof Promise) {
        await result
      }

      // Quit edit mode after saved
      setIsEditing(false)
    } finally {
      // Reset the saving state regardless of success or failure
      setIsSaving(false)
    }
  }, [editText, onEdit])

  /**
   * Handles canceling the edit action.
   */
  const handleEditCancel = useCallback(() => {
    // Reset edit state
    setIsEditing(false)

    // Reset edit text
    setEditText(content)
  }, [content])

  /**
   * Handles starting the edit action.
   */
  const handleEditStart = useCallback(() => {
    // Enter edit mode
    setIsEditing(true)

    // Set edit text to current content
    setEditText(content)
  }, [content])

  return (
    <div className="relative">
      {/* Line spanning the comment thread */}
      {replyCount > 0 && !isCollapsed && (
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
          onClick={onToggleCollapse}
          onMouseEnter={() => setIsLineHovered(true)}
          onMouseLeave={() => setIsLineHovered(false)}
        />
      )}

      {/* Collapse button on the line, hidden until hover */}
      {replyCount > 0 && !isCollapsed && (
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
          onClick={onToggleCollapse}
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
            altText={tComments('avatarAlt', { author })}
            size={AVATAR_SIZE}
          />
        </div>

        {/* Comment body */}
        <div className="flex-1 min-w-0">
          {/* Header - progressive wrapping: [1+2+3] → [1+2][3] → [1][2][3] */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
            {/* Group: Author + Timestamp (wraps together first, then individually) */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {/* (1) Author */}
              <span className="text-sm font-medium text-foreground">{author}</span>

              {/* (2) Timestamp + edited */}
              <span className="text-xs text-muted flex items-center gap-1">
                {format.dateTime(timestamp, {
                  day: 'numeric',
                  month: 'numeric',
                  year:
                    timestamp.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {editedAt && !isDeleted && (
                  <Tooltip
                    placement="top"
                    content={tComments('lastEdited', {
                      date: format.dateTime(editedAt, {
                        day: 'numeric',
                        month: 'numeric',
                        year:
                          editedAt.getFullYear() === new Date().getFullYear()
                            ? undefined
                            : 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })}
                  >
                    <span className="ml-1 cursor-help opacity-80 hover:opacity-100 italic">
                      {tComments('edited')}
                    </span>
                  </Tooltip>
                )}
              </span>
            </div>

            {/* (3) Actions - wraps as a unit after (1+2) group */}
            {!isEditing && !isDeleted && (
              <div className="flex items-center gap-3">
                {/* Like button */}
                {onLike ? (
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
                  <div
                    className={cn(
                      'flex items-center gap-1 text-xs cursor-default',
                      isLiked ? 'text-error' : 'text-muted'
                    )}
                  >
                    <Heart size={14} className={cn(isLiked && 'fill-current')} />
                    <span>{likes}</span>
                  </div>
                )}

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
            <div className="mb-2">
              <RichMathEditor
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
            <div className="text-sm text-muted italic mb-1.5">[{tComments('deleted')}]</div>
          ) : (
            <div className="text-sm text-muted-foreground leading-relaxed mb-1.5">
              <RichMathEditorRenderer content={content} />
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
            paddingTop: replyCount > 0 && !isCollapsed ? '8px' : '0',
            paddingBottom: replyCount > 0 && !isCollapsed ? '8px' : '0',
          }}
        >
          {/* Collapsed state: show expand button with reply count */}
          {replyCount > 0 && isCollapsed ? (
            <button
              onClick={onToggleCollapse}
              className="flex items-center gap-1.5 py-2 text-xs text-link hover:text-link-hover transition-colors"
            >
              <ChevronDown size={14} />
              <span>
                {tComments('show')} {tPlurals('replies', { count: replyCount })}
              </span>
            </button>
          ) : (
            // Expanded state: render children (replies) provided by parent
            repliesNode
          )}

          {/* Reply input  */}
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
