import { useState } from 'react'

import type { CommentTarget } from '../services/comment-api-types'
import { usePendingCommentTarget } from './use-pending-comment-target'

/**
 * Whether the comments modal of one target is open, and the ways to open and close it.
 */
type UseCommentModalResult = {
  /** Whether the modal is open. */
  isOpen: boolean
  /** Opens the modal. */
  open: () => void
  /** Closes the modal, and forgets the target the reader was about to comment on before signing in. */
  close: () => void
}

/**
 * The open state of one target's comments modal. The modal also stands open for a target the reader was about to
 * comment on before signing in, until they close it.
 *
 * @param target - The thing the modal's comments are on.
 * @returns Whether the modal is open, and the ways to open and close it.
 */
export function useCommentModal(target: CommentTarget): UseCommentModalResult {
  // Whether the reader opened the modal
  const [isOpenedByReader, setIsOpenedByReader] = useState(false)

  // The target the reader was about to comment on before signing in
  const { pendingTarget, clearPendingTarget } = usePendingCommentTarget()

  // Whether the pending target is this modal's own
  const isPendingHere =
    pendingTarget !== null &&
    pendingTarget.targetType === target.targetType &&
    pendingTarget.targetId === target.targetId

  // A function which opens the modal
  const open = () => setIsOpenedByReader(true)

  // A function which closes the modal
  const close = () => {
    // The reader's own opening is over
    setIsOpenedByReader(false)

    // The pending target goes too, so a later sign-in opens nothing
    clearPendingTarget()
  }

  // Whether the modal is open, the reader having opened it or a sign-in having brought them back to it
  const isOpen = isOpenedByReader || isPendingHere

  // Whether the modal is open, and the ways to change that
  return { isOpen, open, close }
}
