'use client'

import { useAuth } from '@clerk/nextjs'
import { useIsMutating } from '@tanstack/react-query'
import { type RefObject, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'

import type { RichMathEditorRef } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { hasValidContent } from '@/components/shared/components/rich-math-editor/utils/preprocessors'
import { forgetPersistentDraft, usePersistentDraft } from '@/hooks/use-persistent-draft'

import type { CommentData } from '../components/CommentItem'
import { commentDraftStorageKey } from '../model/comment-drafts'
import type { CommentTarget } from '../services/comment-api-types'
import { commentKeyOf, findCommentInTree } from '../utils/comment-utils'
import { commentMutationKeys } from './comment-query-keys'
import { type CreateCommentParams, useCreateComment } from './use-create-comment'
import { useOpenReply } from './use-open-reply'

/**
 * Options for {@link useCommentReply}.
 */
export type UseCommentReplyOptions = {
  /** The thread the replies go into. */
  target: CommentTarget
  /** The thread's comments on screen, each carrying its replies. */
  comments: CommentData[]
}

/**
 * What {@link useCommentReply} hands back.
 */
export type UseCommentReplyResult = {
  /**
   * The id the comment being replied to has now; null while the reader has no reply open, and once that comment is
   * deleted or gone.
   */
  commentId: string | null
  /** What the open reply says so far. */
  text: string
  /** Rewrites what the open reply says. */
  setText: (text: string) => void
  /** The editor of the open reply, which takes the cursor as the reply opens. */
  editorRef: RefObject<RichMathEditorRef | null>
  /** Opens a reply under a comment, on whatever was written in it before, the cursor in it. */
  open: (comment: CommentData) => void
  /** Closes the reply and drops its draft. */
  cancel: () => void
  /** Posts the open reply. */
  send: () => Promise<void>
  /** Whether the open reply is on its way. */
  isSending: boolean
}

/**
 * The reply open in a thread: which comment it answers, its draft, kept for the reader under that comment until it
 * is sent or cancelled, and the way to send it. The reply is the one {@link useOpenReply} keeps across the site. It
 * shows only while the comment it answers stands in the thread, since nothing could take it otherwise. The reply and
 * its draft follow the comment through its edits, which save it under a new id.
 *
 * @param options - {@link UseCommentReplyOptions}.
 *
 * @returns The open reply and the ways to change it.
 */
export function useCommentReply({
  target,
  comments,
}: UseCommentReplyOptions): UseCommentReplyResult {
  // The reader's id, absent when signed out
  const { userId } = useAuth()

  // The reply open across the site, null while none is
  const openedUnder = useOpenReply((state) => state.openedUnder)

  // The way to open or close the reply open across the site
  const setOpenedUnder = useOpenReply((state) => state.setOpenedUnder)

  // The create behind a reply
  const { mutateAsync: createReply } = useCreateComment()

  // The comment the reply was opened under as this thread holds it now, while the reply is the reader's
  const answered =
    openedUnder !== null && openedUnder.readerId === (userId ?? null)
      ? findCommentInTree(comments, (comment) => commentKeyOf(comment) === openedUnder.commentKey)
      : undefined

  // The comment the reply answers, while it still stands
  const repliedTo = answered?.isDeleted === false ? answered : null

  // The id the replied-to comment has now
  const commentId = repliedTo?.id ?? null

  // The key the replied-to comment keeps through its edits
  const commentKey = repliedTo === null ? null : commentKeyOf(repliedTo)

  // The draft of the open reply, kept for the reader under the comment it answers until it is sent or cancelled
  const [text, setText] = usePersistentDraft(
    commentKey === null ? null : commentDraftStorageKey(userId ?? null, target, commentKey),
    ''
  )

  // Whether a reply to the open reply's comment is on its way, sent from this thread or another showing the comment.
  // A reply under any other comment is left out, so one opened there meanwhile can still be sent
  const isSending =
    useIsMutating({
      mutationKey: commentMutationKeys.creates(),
      predicate: (mutation) =>
        commentId !== null &&
        (mutation.state.variables as CreateCommentParams | undefined)?.parentCommentId ===
          commentId,
    }) > 0

  // The editor of the open reply
  const editorRef = useRef<RichMathEditorRef>(null)

  // A function which opens a reply under a comment, on whatever was written in it before, the cursor in it
  const open = useCallback(
    (comment: CommentData) => {
      // Open the reply as the reader's, its editor on the page at once
      flushSync(() =>
        setOpenedUnder({ commentKey: commentKeyOf(comment), readerId: userId ?? null })
      )

      // Put the cursor in the reply's editor, on opening alone, so an editor coming back onto the page later never
      // takes it
      editorRef.current?.focus()
    },
    [setOpenedUnder, userId]
  )

  // A function which closes the reply and drops its draft
  const cancel = useCallback(() => {
    // Close the reply
    setOpenedUnder(null)

    // Drop the reply draft
    setText('')
  }, [setOpenedUnder, setText])

  // A function which posts the open reply
  const send = useCallback(async () => {
    // Nothing to send without an open reply holding some text
    if (!hasValidContent(text) || commentId === null || commentKey === null) return

    // Post the reply, which comes back as nothing when it never went out or failed, the failure told already
    const created = await createReply({
      target,
      content: text.trim(),
      parentCommentId: commentId,
    }).catch(() => undefined)

    // Unsent, so the reply stays open on its draft
    if (created === undefined) return

    // Sent, so the reply closes, unless one was opened under another comment while it was on its way
    setOpenedUnder((current) => (current?.commentKey === commentKey ? null : current))

    // The reply's draft goes too, by its own key, whatever reply is open by now
    forgetPersistentDraft(commentDraftStorageKey(userId ?? null, target, commentKey))
  }, [text, commentId, commentKey, createReply, setOpenedUnder, userId, target])

  // The open reply and the ways to change it
  return { commentId, text, setText, editorRef, open, cancel, send, isSending }
}
