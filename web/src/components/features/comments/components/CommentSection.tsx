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
import { cn } from '@/components/shared/utils/css-utils'
import { useIsMobile } from '@/hooks/use-breakpoint'
import { isAwaitingAnswer } from '@/lib/query-ui-state'

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
 * Visual variants for the {@link CommentSection}.
 * - 'card': a card of its own (background, border, shadow) from the small breakpoint up
 * - 'inline': Minimal styling that blends with the page content
 */
type CommentSectionVariant = 'card' | 'inline'

/**
 * Props for the {@link CommentSection} component.
 */
type CommentSectionProps = {
  /** The target entity being commented on. */
  target: CommentTarget
  /** How the section sits on the page. */
  variant?: CommentSectionVariant
  /** Whether comments show their likes and can be liked. */
  showLikes?: boolean
  /** What the box for a new comment says before anything is typed in it. */
  newCommentPlaceholder?: string
  /** Whether a thread with no comments says so, and offers a visitor the sign-in button. */
  showEmptyText?: boolean
  /** Whether the box for a new comment takes the cursor as it appears. */
  autoFocus?: boolean
}

/**
 * One target's comment thread: the comments with their nested replies, and a box for writing a new one.
 */
export function CommentSection({
  target,
  variant = 'card',
  showLikes = true,
  newCommentPlaceholder,
  showEmptyText = true,
  autoFocus = false,
}: CommentSectionProps) {
  // The reader, and whether Clerk has settled who they are
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // The reader's username, null until they choose one, and whether their profile is still loading
  const { username, isLoading: isUsernameLoading } = useUserProfile()

  // Whether we know who is here and what they are called, since a missing name reads the same as an unread one
  const isIdentityLoaded = isUserLoaded && !isUsernameLoading

  // Whether the viewport is phone-sized
  const isMobile = useIsMobile()

  // The thread as the server has it, and how far its read got
  const { comments: commentDtos, uiState } = useFetchComments(target)

  // Comment copy
  const tComments = useTranslations('comments')

  // The thread as CommentData, replies nested
  const comments = React.useMemo(() => commentDtos.map(convertToCommentData), [commentDtos])

  // Whether any comment is there to show
  const hasVisibleComments = comments.some((comment) => !shouldHideComment(comment))

  // Whether the list region shows: the comments, or the note that there are none
  const showsList = hasVisibleComments || showEmptyText

  // The create behind a new top-level comment
  const { mutateAsync: createRootComment, isPending: isCreatingRootComment } = useCreateComment()

  // A second create, so the reply editor spins on its own send
  const { mutateAsync: createReply, isPending: isCreatingReplyComment } = useCreateComment()

  // The edit, the delete and the like behind the reader's actions on a comment
  const { mutateAsync: updateComment } = useUpdateComment()
  const { mutate: deleteComment } = useDeleteComment()
  const toggleLike = useToggleCommentLike().mutate

  // Handle pending like restoration (if user liked a comment while not logged in)
  usePendingCommentLike(comments, target)

  // The store for the thread to come back to after signing in
  const { savePendingTarget } = usePendingCommentTarget()

  // A function which remembers this thread before the sign-in redirect
  const handleBeforeLoginRedirect = useCallback(
    () => savePendingTarget(target),
    [savePendingTarget, target]
  )

  // The draft of a new top-level comment
  const [commentInputText, setCommentInputText] = useState('')

  // The ID of the comment that is being replied to (null if none)
  const [replyCommentId, setReplyCommentId] = useState<string | null>(null)

  // The draft of the open reply
  const [replyInputText, setReplyInputText] = useState('')

  // The IDs of comments whose replies are collapsed
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  // A function which posts the new top-level comment
  const handleSubmitComment = useCallback(async () => {
    // Nothing to send in a draft with no text in it
    if (!hasValidContent(commentInputText)) return

    // Post the comment
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

  // A function which posts the open reply
  const handleSubmitReply = useCallback(async () => {
    // Nothing to send without an open reply holding some text
    if (!hasValidContent(replyInputText) || replyCommentId === null) return

    // Post the reply
    await createReply(
      {
        target,
        content: replyInputText.trim(),
        parentCommentId: replyCommentId,
      },
      {
        // Clear reply state only after successful creation
        onSuccess: () => {
          // Close the reply
          setReplyCommentId(null)

          // Drop the reply draft
          setReplyInputText('')
        },
      }
    )
  }, [replyInputText, replyCommentId, createReply, target])

  // A function which opens an empty reply under a comment
  const handleOpenReply = useCallback((commentId: string) => {
    // Open the reply under the comment
    setReplyCommentId(commentId)

    // Start the reply draft empty
    setReplyInputText('')
  }, [])

  // A function which closes the reply and drops its draft
  const handleCancelReply = useCallback(() => {
    // Close the reply
    setReplyCommentId(null)

    // Drop the reply draft
    setReplyInputText('')
  }, [])

  // A function which saves a comment's new text
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

  // A function which deletes a comment
  const handleDeleteComment = useCallback(
    (commentId: string) => {
      deleteComment({
        commentId,
        target,
      })
    },
    [deleteComment, target]
  )

  // A function which likes or unlikes a comment
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

  // A function which collapses or expands a comment's replies
  const handleToggleCollapse = useCallback((commentId: string) => {
    setCollapsedIds((previous) => toggleSetItem(previous, commentId))
  }, [])

  // A function which renders a comment and, under it, its replies
  const renderSingleComment = useCallback(
    (comment: CommentData): React.ReactNode => {
      // A deleted comment with nothing visible under it drops out of the thread
      if (shouldHideComment(comment)) {
        return null
      }

      // The comment's direct replies
      const replies = comment.replies

      // How many live replies sit under the comment, nested ones included
      const replyCount = countAllComments(replies)

      // Whether the reader wrote the comment
      const isOwnComment = isUserLoaded && comment.authorId === userId

      // Render the comment
      return (
        <CommentItem
          key={comment.id}
          author={comment.author}
          avatarUrl={comment.avatarUrl}
          content={comment.content}
          timestamp={comment.timestamp}
          editedAt={comment.editedAt}
          likes={comment.likes}
          isLiked={comment.isLiked}
          isDeleted={comment.isDeleted}
          showLikes={showLikes}
          isCollapsed={collapsedIds.has(comment.id)}
          replyCount={replyCount}
          onToggleCollapse={() => handleToggleCollapse(comment.id)}
          onReply={
            // Replying is offered on a comment still standing, once there is somebody to sign it: a signed-in
            // user with a name
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
            // The inline reply editor under the comment being replied to, on desktop; a phone gets the
            // editor at the bottom
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
              {/* Replies */}
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
      showLikes,
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
  if (isAwaitingAnswer(uiState)) {
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
  if (uiState.kind === 'failed') {
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

  // Whether the new-comment box is there at all, which a visitor on an empty thread goes without
  const showsNewCommentBox = userId || hasVisibleComments

  // Whether a signed-in reader is replying on desktop, with the reply editor under its comment
  const isReplyingInline = userId && replyCommentId !== null && !isMobile

  return (
    <>
      {/* Thread */}
      <div
        className={
          {
            card: 'sm:bg-surface sm:border sm:border-foreground/10 sm:rounded-lg sm:shadow-lg overflow-hidden',
            inline: '',
          }[variant]
        }
      >
        {/* Comments list, or the note that there are none */}
        {showsList && (
          <div
            className={
              {
                card: 'px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-6',
                inline: 'pt-0 pb-6',
              }[variant]
            }
          >
            {hasVisibleComments ? (
              // The thread
              comments.map((comment) => renderSingleComment(comment))
            ) : (
              // The note that there are none, with a sign-in button for a visitor
              <div className="py-6 flex flex-col items-center gap-3 text-center text-muted text-sm">
                <span>{tComments('empty')}</span>
                {isUserLoaded && !userId && (
                  <LoginButton onBeforeRedirect={handleBeforeLoginRedirect} />
                )}
              </div>
            )}
          </div>
        )}

        {/* New comment box */}
        {showsNewCommentBox && (
          <div
            className={cn(
              {
                card: 'px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-5',
                inline: 'pt-4',
              }[variant],
              // A rule between the list and the box
              showsList && 'border-t border-foreground/10',
              // Out of sight while the reply editor sits under its comment. Kept on the page, so the box
              // doesn't take the cursor again once the reply closes
              isReplyingInline && 'hidden'
            )}
          >
            {!isIdentityLoaded ? (
              // Still settling who is reading
              <div className="flex justify-center py-4">
                <LoadingSpinner />
              </div>
            ) : !userId ? (
              // A visitor, offered sign-in
              <div className="flex justify-center py-4">
                <LoginButton onBeforeRedirect={handleBeforeLoginRedirect} />
              </div>
            ) : !username ? (
              // Signed in with no username yet
              <UsernameGate />
            ) : (
              // The editor for a new comment
              <RichMathEditor
                variant={variant}
                maxCharacters={MAX_CHARACTERS_PER_COMMENT}
                value={commentInputText}
                onChange={setCommentInputText}
                onSend={handleSubmitComment}
                placeholder={newCommentPlaceholder ?? tComments('writePlaceholder')}
                autoFocus={autoFocus}
                isLoading={isCreatingRootComment}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile reply editor, outside the thread so no empty padded slot is left under the comment */}
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
