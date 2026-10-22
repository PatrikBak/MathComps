'use client'

import { useTranslations } from 'next-intl'
import React from 'react'
import { useCallback } from 'react'

import { MAX_CHARACTERS_PER_COMMENT } from '@/components/features/comments/model/comment-limits'
import { UsernameGate } from '@/components/features/profile/components/UsernameGate'
import { LoginButton } from '@/components/login/LoginButton'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { hasValidContent } from '@/components/shared/components/rich-math-editor/utils/preprocessors'
import { cn } from '@/components/shared/utils/css-utils'
import { usePersistentDraft } from '@/hooks/use-persistent-draft'
import { isAwaitingAnswer } from '@/lib/query-ui-state'

import { useCollapsedComments } from '../hooks/use-collapsed-comments'
import { useCommentReader } from '../hooks/use-comment-reader'
import { useCommentReply } from '../hooks/use-comment-reply'
import { useCreateComment } from '../hooks/use-create-comment'
import { useFetchComments } from '../hooks/use-fetch-comments'
import { usePendingCommentReaction } from '../hooks/use-pending-comment-reaction'
import { usePendingCommentTarget } from '../hooks/use-pending-comment-target'
import { commentDraftStorageKey } from '../model/comment-drafts'
import type { CommentNewness } from '../model/comment-newness'
import type { CommentTarget } from '../services/comment-api-types'
import { convertToCommentData, shouldHideComment } from '../utils/comment-utils'
import { CommentList, type CommentListVariant } from './CommentList'

/**
 * Props for the {@link CommentSection} component.
 */
type CommentSectionProps = {
  /** The target entity being commented on. */
  target: CommentTarget
  /** How the section sits on the page. */
  variant?: CommentListVariant
  /** Whether comments show their reactions and can be reacted to. */
  showReactions?: boolean
  /** What the box for a new comment says before anything is typed in it. */
  newCommentPlaceholder?: string
  /** Whether a thread with no comments says so, and offers a visitor the sign-in button. */
  showEmptyText?: boolean
  /** Whether the box for a new comment takes the cursor as it appears. */
  autoFocus?: boolean
  /** How far the reader has seen the thread. */
  newness?: CommentNewness
}

/**
 * One target's comment thread: the comments with their nested replies, and a box for writing a new one.
 */
export function CommentSection({
  target,
  variant = 'card',
  showReactions = true,
  newCommentPlaceholder,
  showEmptyText = true,
  autoFocus = false,
  newness = { kind: 'untracked' },
}: CommentSectionProps) {
  // The reader, the name they sign comments with, and how much of that is known yet
  const { userId, isSignInLoaded, username, isIdentityLoaded } = useCommentReader()

  // The thread as the server has it, and how far its read got
  const { comments: commentDtos, uiState } = useFetchComments(target)

  // Comment copy
  const tComments = useTranslations('comments')

  // The thread as CommentData, replies nested
  const comments = React.useMemo(
    () => commentDtos.map((dto) => convertToCommentData(dto, userId ?? null)),
    [commentDtos, userId]
  )

  // Whether any comment is there to show
  const hasVisibleComments = comments.some((comment) => !shouldHideComment(comment))

  // Whether the list region shows: the comments, or the note that there are none
  const showsList = hasVisibleComments || showEmptyText

  // The create behind a new top-level comment
  const { mutateAsync: createRootComment, isPending: isCreatingRootComment } = useCreateComment()

  // The reply open in the thread
  const reply = useCommentReply({ target, comments })

  // Which comments have their replies folded away, held here so a failed refresh that hides the list forgets none
  const collapsed = useCollapsedComments()

  // Handle pending reaction restoration (if user reacted to a comment while not logged in), once the reader's
  // name is known to sign it with
  usePendingCommentReaction({ comments: isIdentityLoaded ? comments : undefined, target })

  // The store for the thread to come back to after signing in
  const { savePendingTarget } = usePendingCommentTarget()

  // A function which remembers this thread before the sign-in redirect
  const handleBeforeLoginRedirect = useCallback(
    () => savePendingTarget(target),
    [savePendingTarget, target]
  )

  // The draft of a new top-level comment, kept for the reader until it is sent
  const [commentInputText, setCommentInputText] = usePersistentDraft(
    commentDraftStorageKey(userId ?? null, target, null),
    ''
  )

  // A function which posts the new top-level comment
  const handleSubmitComment = useCallback(async () => {
    // Nothing to send in a draft with no text in it
    if (!hasValidContent(commentInputText)) return

    // Post the comment, which comes back as nothing when it never went out or failed, the failure told already
    const created = await createRootComment({
      target,
      content: commentInputText.trim(),
      parentCommentId: null,
    }).catch(() => undefined)

    // Unsent, so the draft stays
    if (created === undefined) return

    // Sent, so the draft goes, whether or not the thread is still on screen
    setCommentInputText('')
  }, [commentInputText, createRootComment, setCommentInputText, target])

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
              <CommentList
                target={target}
                comments={comments}
                variant={variant}
                showReactions={showReactions}
                reply={reply}
                collapsed={collapsed}
                newness={newness}
              />
            ) : (
              // The note that there are none, with a sign-in button for a visitor
              <div className="py-6 flex flex-col items-center gap-3 text-center text-muted text-sm">
                <span>{tComments('empty')}</span>
                {isSignInLoaded && !userId && (
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
              showsList && 'border-t border-foreground/10'
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
    </>
  )
}
