'use client'

import { useAuth } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'
import React from 'react'
import { useCallback, useState } from 'react'

import { MAX_CHARACTERS_PER_COMMENT } from '@/components/features/comments/model/comment-limits'
import { UsernameGate } from '@/components/features/profile/components/UsernameGate'
import { useUserProfile } from '@/components/features/profile/hooks/use-user-profile'
import { LoginButton } from '@/components/login/LoginButton'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { hasValidContent } from '@/components/shared/components/rich-math-editor/utils/preprocessors'
import { toggleSetItem } from '@/components/shared/utils/collection-utils'
import { useIsMobile } from '@/hooks/use-breakpoint'

import { useCreateComment } from '../hooks/use-create-comment'
import { useDeleteComment } from '../hooks/use-delete-comment'
import { useFetchComments } from '../hooks/use-fetch-comments'
import { usePendingCommentLike } from '../hooks/use-pending-comment-like'
import { usePendingCommentTarget } from '../hooks/use-pending-comment-target'
import { useToggleCommentLike } from '../hooks/use-toggle-comment-like'
import { useUpdateComment } from '../hooks/use-update-comment'
import type { CommentTarget } from '../services/comment-api-types'
import { convertToCommentData, countAllComments, shouldHideComment } from '../utils/comment-utils'
import { type CommentData, CommentItem } from './CommentItem'

/**
 * Visual variants for the CommentSection.
 * - 'card': Default card-style with background, border, and shadow
 * - 'inline': Minimal styling that blends with the page content
 */
type CommentSectionVariant = 'card' | 'inline'

/**
 * Props for the {@link CommentSection} component.
 */
type CommentSectionProps = {
  /** The target entity being commented on. */
  target: CommentTarget
  /** Visual variant of the comment section. */
  variant?: CommentSectionVariant
}

/**
 * A comment section component with threaded replies.
 */
export function CommentSection({ target, variant = 'card' }: CommentSectionProps) {
  // Get current user ID for ownership checks
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // The name this comment would be signed with, absent until they have chosen one
  const { username, isLoading: isUsernameLoading } = useUserProfile()

  // Whether we know who is here and what they are called, since a missing name reads the same as an unread one
  const isIdentityLoaded = isUserLoaded && !isUsernameLoading

  // Check if we are on mobile (used for conditional UI behavior)
  const isMobile = useIsMobile()

  // Fetch comments from API
  const { data: commentsDtos, isLoading, error } = useFetchComments(target)

  // Get translations for UI
  const tComments = useTranslations('comments')

  // Convert the comment into our custom structure
  const comments = React.useMemo(() => {
    return commentsDtos?.map(convertToCommentData) || []
  }, [commentsDtos])

  // Prepare functions to manipulate comments
  const { mutateAsync: createRootComment, isPending: isCreatingRootComment } = useCreateComment()
  const { mutateAsync: createReply, isPending: isCreatingReplyComment } = useCreateComment()
  const { mutateAsync: updateComment } = useUpdateComment()
  const { mutate: deleteComment } = useDeleteComment()
  const toggleLike = useToggleCommentLike().mutate

  // Handle pending like restoration (if user liked a comment while not logged in)
  usePendingCommentLike(comments, target)

  // We need a function to save the target to the pending comment target
  // so we can restore the page after logging in
  const { savePendingTarget } = usePendingCommentTarget()
  const handleBeforeLoginRedirect = useCallback(
    () => savePendingTarget(target),
    [savePendingTarget, target]
  )

  // The text for the editor at the bottom (for new non-reply comments)
  const [commentInputText, setCommentInputText] = useState('')

  // The ID of the comment that is being replied to (null if none)
  const [replyCommentId, setReplyCommentId] = useState<string | null>(null)

  // The text for the reply editor (for replies to specific comments)
  const [replyInputText, setReplyInputText] = useState('')

  // The IDs of comments that are collapsed (to support collapsing threads)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  /** Handles submitting a new top-level comment */
  const handleSubmitComment = useCallback(async () => {
    // Guard against empty comments or only whitespace/<br> tags
    if (!hasValidContent(commentInputText)) return

    // Create the comment via API
    await createRootComment(
      {
        target,
        content: commentInputText.trim(),
        parentCommentId: null,
      },
      {
        // Clear input only after successful creation
        onSuccess: () => setCommentInputText(''),
      }
    )
  }, [commentInputText, createRootComment, target])

  /** Handles submitting a reply to a specific comment */
  const handleSubmitReply = useCallback(async () => {
    // Guard against empty replies or no reply state
    if (!hasValidContent(replyInputText) || replyCommentId === null) return

    // Create the reply via API
    await createReply(
      {
        target,
        content: replyInputText.trim(),
        parentCommentId: replyCommentId,
      },
      {
        // Clear reply state only after successful creation
        onSuccess: () => {
          setReplyCommentId(null)
          setReplyInputText('')
        },
      }
    )
  }, [replyInputText, replyCommentId, createReply, target])

  /**
   * Opens reply input for a specific comment
   */
  const handleOpenReply = useCallback((commentId: string) => {
    setReplyCommentId(commentId)
    setReplyInputText('')
  }, [])

  /** Cancels the current reply */
  const handleCancelReply = useCallback(() => {
    setReplyCommentId(null)
    setReplyInputText('')
  }, [])

  /**
   * Handles editing a comment.
   */
  const handleEditComment = useCallback(
    async (commentId: string, newContent: string) => {
      await updateComment({
        commentId,
        target,
        content: newContent,
      })
    },
    [updateComment, target]
  )

  /**
   * Handles soft-deleting a comment.
   */
  const handleDeleteComment = useCallback(
    (commentId: string) => {
      deleteComment({
        commentId,
        target,
      })
    },
    [deleteComment, target]
  )

  /**
   * Handles toggling like on a comment.
   */
  const handleLikeComment = useCallback(
    (commentId: string, isCurrentlyLiked: boolean) => {
      toggleLike({
        commentId,
        target,
        isCurrentlyLiked,
      })
    },
    [toggleLike, target]
  )

  /**
   * Toggles the collapsed state of a comment.
   */
  const handleToggleCollapse = useCallback((commentId: string) => {
    setCollapsedIds((previous) => toggleSetItem(previous, commentId))
  }, [])

  /**
   * Renders a single comment with its replies recursively.
   */
  const renderSingleComment = useCallback(
    (comment: CommentData): React.ReactNode => {
      // If the comment should be hidden according to our rules, don't render it
      if (shouldHideComment(comment)) {
        return null
      }

      // Get the replies as an array
      const replies = comment.replies || []

      // Count the total number of replies (including nested replies)
      const replyCount = countAllComments(replies)

      // Check if the current user is the author of this comment
      const isOwnComment = isUserLoaded && comment.authorId === userId

      // Render the comment
      return (
        <CommentItem
          key={comment.id}
          authorId={comment.authorId}
          author={comment.author}
          avatarUrl={comment.avatarUrl}
          content={comment.content}
          timestamp={comment.timestamp}
          editedAt={comment.editedAt}
          likes={comment.likes}
          isLiked={comment.isLiked}
          isDeleted={comment.isDeleted}
          isCollapsed={collapsedIds.has(comment.id)}
          replyCount={replyCount}
          onToggleCollapse={() => handleToggleCollapse(comment.id)}
          onReply={
            // Replying is offered once there is somebody to sign it, which is a signed-in user with a name
            comment.isDeleted || !isIdentityLoaded || !userId || !username
              ? undefined
              : () => handleOpenReply(comment.id)
          }
          onLike={isOwnComment ? undefined : () => handleLikeComment(comment.id, comment.isLiked)}
          onEdit={
            // Allow editing only for own comments that are not deleted
            isOwnComment && !comment.isDeleted
              ? (newContent) => handleEditComment(comment.id, newContent)
              : undefined
          }
          onDelete={
            // Allow deleting only for own comments that are not deleted
            isOwnComment && !comment.isDeleted ? () => handleDeleteComment(comment.id) : undefined
          }
          replyInputNode={
            // On mobile, reply is handled by the standalone modal below (not inline)
            // On desktop, render the inline editor
            replyCommentId === comment.id && !isMobile ? (
              <RichMathEditor
                variant={variant}
                maxCharacters={MAX_CHARACTERS_PER_COMMENT}
                value={replyInputText}
                onChange={setReplyInputText}
                onSend={handleSubmitReply}
                onCancel={handleCancelReply}
                placeholder={tComments('replyPlaceholder')}
                autoFocus
                isLoading={isCreatingReplyComment}
              />
            ) : undefined
          }
          repliesNode={
            <>
              {/* Child comments rendered recursively */}
              {replies.map((reply) => renderSingleComment(reply))}
            </>
          }
        />
      )
    },
    [
      isMobile,
      isUserLoaded,
      isIdentityLoaded,
      userId,
      username,
      variant,
      collapsedIds,
      replyCommentId,
      replyInputText,
      isCreatingReplyComment,
      handleToggleCollapse,
      handleOpenReply,
      handleEditComment,
      handleDeleteComment,
      handleLikeComment,
      handleSubmitReply,
      handleCancelReply,
      tComments,
    ]
  )

  // Show loading state
  if (isLoading) {
    return (
      <div
        className={
          {
            card: 'sm:bg-surface sm:border sm:border-foreground/10 sm:rounded-lg sm:shadow-lg overflow-hidden',
            inline: 'pt-0 pb-6',
          }[variant]
        }
      >
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div
        className={
          {
            card: 'sm:bg-surface sm:border sm:border-foreground/10 sm:rounded-lg sm:shadow-lg overflow-hidden',
            inline: 'pt-0 pb-6',
          }[variant]
        }
      >
        <div className="py-6 text-center text-error text-sm">{tComments('loadError')}</div>
      </div>
    )
  }

  return (
    <>
      <div
        className={
          {
            card: 'sm:bg-surface sm:border sm:border-foreground/10 sm:rounded-lg sm:shadow-lg overflow-hidden',
            inline: '',
          }[variant]
        }
      >
        {/* Comments list */}
        <div
          className={
            {
              card: 'px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-6',
              inline: 'pt-0 pb-6',
            }[variant]
          }
        >
          {!comments || !comments.some((comment) => !shouldHideComment(comment)) ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center text-muted text-sm">
              <span>{tComments('empty')}</span>
              {isUserLoaded && !userId && (
                <LoginButton onBeforeRedirect={handleBeforeLoginRedirect} />
              )}
            </div>
          ) : (
            comments.map((comment) => renderSingleComment(comment))
          )}
        </div>

        {/* New comment input - hidden when replying on desktop (mobile uses modal instead) */}
        {!(userId && replyCommentId !== null && !isMobile) &&
          (userId || comments.some((comment) => !shouldHideComment(comment))) && (
            <div
              className={
                {
                  card: 'px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-5 border-t border-foreground/10',
                  inline: 'pt-4 border-t border-foreground/10',
                }[variant]
              }
            >
              {!isIdentityLoaded ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : !userId ? (
                <div className="flex justify-center py-4">
                  <LoginButton onBeforeRedirect={handleBeforeLoginRedirect} />
                </div>
              ) : !username ? (
                <UsernameGate />
              ) : (
                <RichMathEditor
                  variant={variant}
                  maxCharacters={MAX_CHARACTERS_PER_COMMENT}
                  value={commentInputText}
                  onChange={setCommentInputText}
                  onSend={handleSubmitComment}
                  placeholder={tComments('writePlaceholder')}
                  isLoading={isCreatingRootComment}
                />
              )}
            </div>
          )}
      </div>

      {/* Mobile reply editor - rendered outside CommentItem to avoid padding issues */}
      {isMobile && replyCommentId !== null && (
        <RichMathEditor
          variant={variant}
          maxCharacters={MAX_CHARACTERS_PER_COMMENT}
          value={replyInputText}
          onChange={setReplyInputText}
          onSend={handleSubmitReply}
          onCancel={handleCancelReply}
          placeholder={tComments('replyPlaceholder')}
          autoExpandOnMobile
          isLoading={isCreatingReplyComment}
        />
      )}
    </>
  )
}
