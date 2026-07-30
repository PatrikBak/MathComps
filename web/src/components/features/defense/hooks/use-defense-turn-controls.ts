'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { RichMathEditorRef } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { AppErrorCode } from '@/lib/api/api-error-codes'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import type { DeleteOutcome, RewindOutcome, SendOutcome } from '../model/defense-conversation-model'
import type { Turn } from '../model/defense-types'

/**
 * A rewind awaiting confirmation: the cut point to keep through, and the composer draft to restore once
 * it's confirmed (the rewound student turn's text, or empty when rewinding to an examiner turn).
 */
type RewindTarget = {
  /** The sequence of the last turn to keep; every later turn is dropped. */
  keepThroughSequence: number
  /** The text to drop into the composer after the rewind. */
  draft: string
}

/**
 * The conversation the controls drive. Each is documented at its home on the conversation the caller is
 * already holding.
 */
type DefenseTurnControlsInput = {
  /** The conversation so far, oldest first. */
  turns: readonly Turn[]
  /** Whether the examiner is currently producing a reply. */
  isThinking: boolean
  /** An id for the current conversation, distinct across conversations. */
  conversationEpoch: number
  /** Sends a student turn and folds in the examiner's reply. */
  send: (content: string) => Promise<SendOutcome>
  /** Aborts the in-flight reply, handing back the student turn that triggered it. */
  stop: () => string | null
  /** Rewinds the conversation to a chosen point, dropping every later turn. */
  rewind: (keepThroughSequence: number) => Promise<RewindOutcome>
  /** Deletes a session, dropping back to a fresh conversation when it was the open one. */
  deleteSession: (sessionId: string) => Promise<DeleteOutcome>
}

/**
 * The composer and the controls that act on the conversation around it.
 */
type UseDefenseTurnControlsResult = {
  /** The in-progress composer text. */
  draft: string
  /** Replaces it. */
  setDraft: (draft: string) => void
  /** The composer's handle. */
  editorRef: React.RefObject<RichMathEditorRef | null>
  /** Sends the composed reply. */
  sendDraft: () => Promise<void>
  /** Stops the in-flight reply. */
  stopReply: () => void
  /** Removes a session from history. */
  removeSession: (sessionId: string) => Promise<void>
  /** The rewind awaiting confirmation, or null when none is. */
  rewindTarget: RewindTarget | null
  /** Arms the rewind confirmation for the turn at the given index. */
  requestRewind: (index: number) => void
  /** Runs the armed rewind. */
  confirmRewind: () => Promise<void>
  /** Leaves the conversation as it is. */
  cancelRewind: () => void
}

/**
 * Drives a defense conversation from the composer's side: what is typed, what sending or stopping does with
 * it, and the two conversation-wide actions that report their own failures. The conversation itself belongs
 * to the caller; this is everything the chat would otherwise hold to work it.
 *
 * @param conversation - The conversation being worked, and the actions that change it.
 *
 * @returns The composer, and the controls that act around it.
 */
export function useDefenseTurnControls(
  conversation: DefenseTurnControlsInput
): UseDefenseTurnControlsResult {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // The in-progress composer text
  const [draft, setDraft] = useState('')

  // The rewind awaiting confirmation, or null
  const [rewindTarget, setRewindTarget] = useState<RewindTarget | null>(null)

  // The composer's handle
  const editorRef = useRef<RichMathEditorRef>(null)

  // The composer outlives the conversation it writes into, so hand it the cursor whenever another
  // one takes over
  useEffect(() => {
    editorRef.current?.focus()
  }, [conversation.conversationEpoch])

  // Toasts a failed action's message: the code's central copy, else the action's generic fallback
  const showActionError = (
    errorCode: AppErrorCode | undefined,
    fallback: 'sendError' | 'rewindError' | 'deleteError'
  ) => {
    toast.error(resolveErrorMessage(errorCode, tApiErrors, { fallback: t(fallback) }))
  }

  // Sends the composed reply, unless it's empty or a turn is already in flight
  const sendDraft = async () => {
    // The trimmed reply
    const content = draft.trim()

    // Bail when there's nothing to send or the examiner is still working
    if (!content || conversation.isThinking) {
      return
    }

    // Clear the composer optimistically
    setDraft('')

    // Drive the turn
    const outcome = await conversation.send(content)

    // Recover per outcome
    switch (outcome.kind) {
      // The reply landed, or a stop already reclaimed the draft: nothing to do
      case 'sent':
      case 'stopped':
        break
      // The round-trip failed: tell the student why and hand their draft back to resend
      case 'failed':
        showActionError(outcome.errorCode, 'sendError')
        setDraft((current) => (current.trim() ? current : content))
        break
      // A double-tap: the in-flight turn already carries this content, so the composer stays cleared
      case 'busy':
        break
      default:
        assertNever(outcome)
    }
  }

  // Removes a session from history, telling the student why a failed delete left it in place
  const removeSession = async (sessionId: string) => {
    // Drop the session
    const outcome = await conversation.deleteSession(sessionId)

    // Recover per outcome
    switch (outcome.kind) {
      // Gone: the history already refreshed to drop it
      case 'done':
        break
      // Still there: tell the student why the delete didn't take
      case 'failed':
        showActionError(outcome.errorCode, 'deleteError')
        break
      default:
        assertNever(outcome)
    }
  }

  // Stops the in-flight reply and drops the reclaimed turn back into the composer
  const stopReply = () => {
    // Abort the reply and take back the student turn that triggered it
    const reclaimed = conversation.stop()

    // Restore the reclaimed turn, above anything typed while it was in flight
    if (reclaimed !== null) {
      setDraft((current) => (current.trim() ? `${reclaimed}\n\n${current}` : reclaimed))
    }
  }

  // Arms the rewind confirmation for the turn at the given index, working out the cut point and the
  // composer draft to restore: rewinding to an examiner turn keeps it and empties the composer, while
  // rewinding to a student turn drops it and lifts its text back into the composer to redo. The
  // transcript is the contiguous 0..N turns the server stores, so a turn's index is its server sequence.
  const requestRewind = (index: number) => {
    // The confirmation hands the cursor back to whatever held it when it opened, and the rewind can
    // drop the very button that did, so send the cursor to the composer before arming it
    editorRef.current?.focus()

    // The turn the rewind targets
    const turn = conversation.turns[index]

    // Decide the cut point and the draft per who authored the targeted turn
    switch (turn.role) {
      // Keep the examiner turn as the new last one; nothing to restore
      case 'examiner':
        setRewindTarget({ keepThroughSequence: index, draft: '' })
        break
      // Drop the student turn, keeping the examiner turn before it, and restore the dropped text
      case 'candidate':
        setRewindTarget({ keepThroughSequence: index - 1, draft: turn.content })
        break
      default:
        assertNever(turn.role)
    }
  }

  // Disarms the rewind confirmation, leaving the conversation as it is
  const cancelRewind = () => setRewindTarget(null)

  // Runs the armed rewind, restoring the composer draft on success
  const confirmRewind = async () => {
    // Nothing armed
    if (rewindTarget === null) {
      return
    }

    // Truncate the conversation
    const outcome = await conversation.rewind(rewindTarget.keepThroughSequence)

    // Recover per outcome
    switch (outcome.kind) {
      // The tail is gone: restore the target's text, but never clobber a draft the student is mid-typing
      case 'done':
        setDraft((current) => (current.trim() ? current : rewindTarget.draft))
        break
      // The round-trip failed: tell the student why, leaving the conversation untouched
      case 'failed':
        showActionError(outcome.errorCode, 'rewindError')
        break
      default:
        assertNever(outcome)
    }
  }

  // The composer, and the controls that act around it
  return {
    draft,
    setDraft,
    editorRef,
    sendDraft,
    stopReply,
    removeSession,
    rewindTarget,
    requestRewind,
    confirmRewind,
    cancelRewind,
  }
}
