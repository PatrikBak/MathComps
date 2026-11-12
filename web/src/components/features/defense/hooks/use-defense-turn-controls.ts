'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { RichMathEditorRef } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'
import { usePersistentDraft } from '@/hooks/use-persistent-draft'
import type { AppErrorCode } from '@/lib/api/api-error-codes'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import type { DeleteOutcome, RewindOutcome, SendOutcome } from '../model/defense-conversation-model'
import type { DefenseTarget } from '../model/defense-target'
import { defenseDraftStorageKey } from '../model/defense-target'
import type { DefenseTurnPhoto, Turn } from '../model/defense-types'
import type { UseComposerPhotosResult } from './use-composer-photos'
import { useComposerPhotos } from './use-composer-photos'
import { useDefensePhotoHandoffPages } from './use-defense-photo-handoff-pages'

/**
 * A rewind awaiting confirmation: the cut point to keep through, and the student's turn it drops, which comes back
 * into an empty composer once the rewind lands.
 */
type RewindTarget = {
  /** The sequence of the last turn to keep; every later turn is dropped. */
  keepThroughSequence: number
  /** The student's turn the rewind drops, its text and photos to redo; null when rewinding to an examiner turn. */
  droppedTurn: Turn | null
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
  /** Sends a student turn and its photos, and folds in the examiner's reply. */
  send: (content: string, photos: readonly DefenseTurnPhoto[]) => Promise<SendOutcome>
  /** Aborts the in-flight reply, handing back the student turn that triggered it. */
  stop: () => string | null
  /** Rewinds the conversation to a chosen point, dropping every later turn. */
  rewind: (keepThroughSequence: number) => Promise<RewindOutcome>
  /** Deletes a session, dropping back to a fresh conversation when it was the open one. */
  deleteSession: (sessionId: string) => Promise<DeleteOutcome>
  /** What the student is defending. */
  target: DefenseTarget
  /** The most pixels a photo keeps along its longer side once read, or null while that is not known yet. */
  photoLongEdge: number | null
  /** The most photos one message may carry, or null while that is not known yet. */
  maxPhotosPerMessage: number | null
}

/**
 * The composer and the controls that act on the conversation around it.
 */
type UseDefenseTurnControlsResult = {
  /** The in-progress composer text. */
  draft: string
  /** Replaces it. */
  setDraft: (draft: string) => void
  /** The photos of handwritten work the composer holds. */
  photos: UseComposerPhotosResult
  /** The ids of the pages the student's phone sent last, in page order, or none before any came. */
  latestArrival: readonly number[]
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

  // The in-progress composer text, kept across closes and reloads wherever the target keeps a draft
  const [draft, setDraft] = usePersistentDraft({
    storageKey: defenseDraftStorageKey(conversation.target),
    emptyValue: '',
  })

  // The rewind awaiting confirmation, or null
  const [rewindTarget, setRewindTarget] = useState<RewindTarget | null>(null)

  // Whether a confirmed rewind is still on its way, which would cut a turn sent meanwhile off the conversation
  const [isRewinding, setIsRewinding] = useState(false)

  // The composer's handle
  const editorRef = useRef<RichMathEditorRef>(null)

  // The composer's photos, each one's text waiting beside it until it goes into the draft, no more picked than one
  // message may carry
  const photos = useComposerPhotos({
    target: conversation.target,
    photoLongEdge: conversation.photoLongEdge,
    maxPhotos: conversation.maxPhotosPerMessage,
  })

  // The latest pages the student's phone sent, each joining the composer's photos as it comes
  const { latestArrival } = useDefensePhotoHandoffPages({
    target: conversation.target,
    onArrive: photos.addArrived,
  })

  // The composer outlives the conversation it writes into, so hand it the cursor whenever another
  // one takes over
  useEffect(() => {
    editorRef.current?.focus()
  }, [conversation.conversationEpoch])

  // Toasts a failed action's message: the code's central copy, filled with any values it names, else the action's
  // generic fallback
  const showActionError = (
    errorCode: AppErrorCode | undefined,
    fallback: 'sendError' | 'rewindError' | 'deleteError',
    data?: Record<string, number>
  ) => {
    toast.error(resolveErrorMessage(errorCode, tApiErrors, { fallback: t(fallback), data }))
  }

  /**
   * A function which puts text taken back from the conversation into the composer, above anything typed while it
   * was away.
   *
   * @param text - The text taken back.
   */
  const reclaimText = (text: string) => {
    // Above what was typed meanwhile, a blank line between, or alone in a composer left empty
    setDraft((current) => (current.trim() ? `${text}\n\n${current}` : text))
  }

  // Sends the composed reply, unless it's empty, a turn is in flight, or a rewind is cutting the conversation
  const sendDraft = async () => {
    // The trimmed reply
    const content = draft.trim()

    // Bail when there's nothing to send, the examiner is still working, or the conversation is being cut
    if (!content || conversation.isThinking || isRewinding) {
      return
    }

    // The photos whose text the reply carries, in page order
    const insertedPhotos = photos.photos.filter((photo) => photo.kind === 'inserted')

    // The composer's ids for the reply's photos
    const sentPhotoIds = insertedPhotos.map((photo) => photo.id)

    // Clear the composer optimistically
    setDraft('')

    // The photos go with the reply until it lands or fails
    photos.setAside(sentPhotoIds)

    // The reply's photos as its turn shows them until the stored ones come back: previewing as the composer shows
    // them, their drawings not cut out yet
    const sentPhotos = insertedPhotos.map(
      (photo): DefenseTurnPhoto => ({ id: photo.photoId, link: photo.previewUrl, crops: [] })
    )

    // Drive the turn
    const outcome = await conversation.send(content, sentPhotos)

    // Recover per outcome
    switch (outcome.kind) {
      // The reply landed, so the photos whose text it carried are done with, and any picked while it was
      // out stay
      case 'sent':
        photos.removePhotos(sentPhotoIds)
        break
      // The student stopped the turn: its photos come back, as its text did with the stop
      case 'stopped':
        photos.bringBack(sentPhotoIds)
        break
      // Another conversation took over, dropping the turn's text, and its photos go with it
      case 'superseded':
        photos.removePhotos(sentPhotoIds)
        break
      // The round-trip failed
      case 'failed':
        // Tell the student why, the refusal of too many photos naming how many a message may carry
        showActionError(
          outcome.errorCode,
          'sendError',
          conversation.maxPhotosPerMessage === null
            ? undefined
            : { max: conversation.maxPhotosPerMessage }
        )

        // Where the API can no longer find a photo the reply carried, all its photos are dropped; any other
        // failure hands them back
        if (outcome.errorCode === 'DefensePhotoNotFound') photos.removePhotos(sentPhotoIds)
        else photos.bringBack(sentPhotoIds)

        // The draft comes back to resend
        reclaimText(content)
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
      // Gone: nothing to tell the student
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

    // Restore the reclaimed turn
    if (reclaimed !== null) {
      reclaimText(reclaimed)
    }
  }

  // Arms the rewind confirmation for the turn at the given index, working out the cut point and what comes back
  // into the composer: rewinding to an examiner turn keeps it and restores nothing, while rewinding to a student
  // turn drops it and lifts its text and photos back into the composer to redo. The transcript is the contiguous
  // 0..N turns the server stores, so a turn's index is its server sequence.
  const requestRewind = (index: number) => {
    // The confirmation hands the cursor back to whatever held it when it opened, and the rewind can
    // drop the very button that did, so send the cursor to the composer before arming it
    editorRef.current?.focus()

    // The turn the rewind targets
    const turn = conversation.turns[index]

    // Decide the cut point and what comes back per who authored the targeted turn
    switch (turn.role) {
      // Keep the examiner turn as the new last one; nothing to restore
      case 'examiner':
        setRewindTarget({ keepThroughSequence: index, droppedTurn: null })
        break
      // Drop the student turn, keeping the examiner turn before it, and restore what it carried
      case 'candidate':
        setRewindTarget({ keepThroughSequence: index - 1, droppedTurn: turn })
        break
      default:
        assertNever(turn.role)
    }
  }

  // Disarms the rewind confirmation, leaving the conversation as it is
  const cancelRewind = () => setRewindTarget(null)

  /**
   * A function which puts a dropped student turn back into the composer to redo: its text, and its photos with
   * their text in the message again.
   *
   * @param dropped - The dropped turn.
   */
  const restoreTurn = (dropped: Turn) => {
    // The turn's text
    reclaimText(dropped.content)

    // The turn's photos, so it goes out with them again
    photos.restoreSent(dropped.photos)
  }

  // Runs the armed rewind, restoring the dropped turn on success
  const confirmRewind = async () => {
    // Nothing armed
    if (rewindTarget === null) {
      return
    }

    // The turn that comes back, only into a composer the student hadn't started writing in
    const restored = draft.trim() ? null : rewindTarget.droppedTurn

    // Nothing goes out until the conversation is cut
    setIsRewinding(true)

    // Truncate the conversation
    const outcome = await conversation.rewind(rewindTarget.keepThroughSequence).finally(() => {
      // Sending is open again however the rewind ended
      setIsRewinding(false)
    })

    // Recover per outcome
    switch (outcome.kind) {
      // The tail is gone. Another conversation of the same problem may have taken over meanwhile, its composer
      // the same one, so the dropped turn comes back there too
      case 'done':
      case 'superseded':
        // The dropped turn back where it can be redone, unless the student had started writing
        if (restored !== null) restoreTurn(restored)
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
    photos,
    latestArrival,
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
