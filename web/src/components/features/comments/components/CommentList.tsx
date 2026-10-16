'use client'

import { useTranslations } from 'next-intl'
import React, { useCallback } from 'react'

import { MAX_CHARACTERS_PER_COMMENT } from '@/components/features/comments/model/comment-limits'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { useIsMobile } from '@/hooks/use-breakpoint'

import type { UseCollapsedCommentsResult } from '../hooks/use-collapsed-comments'
import { useCommentReader } from '../hooks/use-comment-reader'
import type { UseCommentReplyResult } from '../hooks/use-comment-reply'
import { useDeleteComment } from '../hooks/use-delete-comment'
import { usePressCommentReaction } from '../hooks/use-press-comment-reaction'
import { useUpdateComment } from '../hooks/use-update-comment'
import type { CommentReactionKind, CommentTarget } from '../services/comment-api-types'
import { countAllComments, shouldHideComment } from '../utils/comment-utils'
import { type CommentData, CommentItem } from './CommentItem'

/**
 * How a thread sits on the page.
 * - 'card': a card of its own (background, border, shadow) from the small breakpoint up
 * - 'inline': minimal styling that blends with the page content
 */
export type CommentListVariant = 'card' | 'inline'

/**
 * Props for the {@link CommentList} component.
 */
type CommentListProps = {
  /** The thread the comments belong to. */
  target: CommentTarget
  /** The comments, each carrying its replies. */
  comments: CommentData[]
  /** How the thread sits on the page. */
  variant: CommentListVariant
  /** Whether comments show their reactions and can be reacted to. */
  showReactions: boolean
  /** The reply open in the thread. */
  reply: UseCommentReplyResult
  /** Which comments have their replies folded away. */
  collapsed: UseCollapsedCommentsResult
}

/**
 * Comments of one thread with their nested replies, edited, deleted, reacted to and replied to in place. The open
 * reply's editor sits under the comment it answers, or on a phone opens over the whole screen.
 */
export function CommentList({
  target,
  comments,
  variant,
  showReactions,
  reply,
  collapsed,
}: CommentListProps) {
  // The reader, the name they sign comments with, and how much of that is known yet
  const { userId, isSignInLoaded, username, isIdentityLoaded } = useCommentReader()

  // Whether the viewport is phone-sized
  const isMobile = useIsMobile()

  // The edit behind the reader's edits
  const { mutateAsync: updateComment } = useUpdateComment()

  // The delete behind the reader's deletions
  const { mutate: deleteComment } = useDeleteComment()

  // The press behind the reader's reactions on the thread
  const pressReaction = usePressCommentReaction(target)

  // A function which saves a comment's new text
  const handleEditComment = useCallback(
    async (commentId: string, newContent: string) => {
      // Save the comment's new text
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
      // Delete the comment
      deleteComment({
        commentId,
        target,
      })
    },
    [deleteComment, target]
  )

  // A function which presses a reaction on a comment
  const handleReactToComment = useCallback(
    (commentId: string, kind: CommentReactionKind) => {
      // Press the reaction on the comment
      pressReaction({ commentId, kind })
    },
    [pressReaction]
  )

  // A function which renders a comment and, under it, its replies
  const renderSingleComment = (comment: CommentData): React.ReactNode => {
    // A deleted comment with nothing visible under it drops out of the thread
    if (shouldHideComment(comment)) {
      return null
    }

    // The comment's direct replies
    const replies = comment.replies

    // How many live replies sit under the comment, nested ones included
    const replyCount = countAllComments(replies)

    // Whether the reader wrote the comment
    const isOwnComment = isSignInLoaded && comment.authorId === userId

    // Render the comment
    return (
      <CommentItem
        key={comment.id}
        variant={variant}
        author={comment.author}
        avatarUrl={comment.avatarUrl}
        content={comment.content}
        timestamp={comment.timestamp}
        editedAt={comment.editedAt}
        reactions={comment.reactions}
        viewerReaction={comment.viewerReaction}
        isDeleted={comment.isDeleted}
        showReactions={showReactions}
        isCollapsed={collapsed.isCollapsed(comment.id)}
        replyCount={replyCount}
        onToggleCollapse={() => collapsed.toggle(comment.id)}
        onReply={
          // Replying is offered on a comment still standing, once there is somebody to sign it: a signed-in
          // user with a name
          comment.isDeleted || !isIdentityLoaded || !userId || !username
            ? undefined
            : () => reply.open(comment.id)
        }
        onReact={
          // Reacting is offered on every comment but the reader's own
          isOwnComment ? undefined : (kind) => handleReactToComment(comment.id, kind)
        }
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
          // editor over the whole screen
          reply.commentId === comment.id && !isMobile ? (
            <ReplyEditor reply={reply} variant={variant} placement="inline" />
          ) : undefined
        }
        repliesNode={
          <>
            {/* Replies */}
            {replies.map((nested) => renderSingleComment(nested))}
          </>
        }
      />
    )
  }

  return (
    <>
      {/* Every comment, each with its replies under it */}
      {comments.map((comment) => renderSingleComment(comment))}

      {/* The open reply's editor on a phone, over the whole screen */}
      {isMobile && reply.commentId !== null && (
        <ReplyEditor reply={reply} variant={variant} placement="fullScreen" />
      )}
    </>
  )
}

/**
 * Where a {@link ReplyEditor} sits: under the comment it answers, or over a phone's whole screen.
 */
type ReplyEditorPlacement = 'inline' | 'fullScreen'

/**
 * Props for the {@link ReplyEditor} component.
 */
type ReplyEditorProps = {
  /** The reply open in the thread. */
  reply: UseCommentReplyResult
  /** How the thread sits on the page. */
  variant: CommentListVariant
  /** Where the editor sits. */
  placement: ReplyEditorPlacement
}

/**
 * The editor of the reply open in a thread. Under its comment it takes the cursor as the reply opens; on a phone it
 * opens over the whole screen.
 */
function ReplyEditor({ reply, variant, placement }: ReplyEditorProps) {
  // Comment copy
  const tComments = useTranslations('comments')

  return (
    <RichMathEditor
      variant={variant}
      maxCharacters={MAX_CHARACTERS_PER_COMMENT}
      value={reply.text}
      onChange={reply.setText}
      onSend={reply.send}
      onCancel={reply.cancel}
      placeholder={tComments('replyPlaceholder')}
      isLoading={reply.isSending}
      // Over the whole screen on a phone, open from the start
      expandedOnly={placement === 'fullScreen'}
      // The reply's handle onto its editor
      ref={reply.editorRef}
    />
  )
}
