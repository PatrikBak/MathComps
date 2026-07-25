'use client'

import { Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import type {
  RichMathEditorRef,
  ToolbarConfig,
} from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { AppErrorCode } from '@/lib/api/api-error-codes'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import { useDefenseConversation } from '../hooks/use-defense-conversation'
import type { DefenseProblem, TurnRole } from '../model/defense-types'
import { DefenseHistoryMenu } from './DefenseHistoryMenu'
import { DefenseTranscript } from './DefenseTranscript'
import { ProblemStrip } from './ProblemStrip'

/**
 * A conversation opened from the problem itself, with the reference solution in scope: it resumes the newest saved
 * defense and can always open a fresh one.
 */
type FromProblemMode = {
  /** The discriminator. */
  kind: 'fromProblem'
}

/**
 * A conversation reopened from the user's list of defenses, away from the problem it was held on. Only the named
 * session continues: the reference solution a fresh defense is argued against lives with the problem, not the
 * session, so there's nothing to open one with.
 */
type ContinueSavedMode = {
  /** The discriminator. */
  kind: 'continueSaved'
  /** The saved session to reopen. */
  sessionId: string
  /** Called once that session is gone, leaving nothing to continue. */
  onSessionGone: () => void
}

/**
 * How a defense conversation was reached, which decides whether a fresh defense can be started from it.
 */
export type DefenseConversationMode = FromProblemMode | ContinueSavedMode

/**
 * Props for the {@link DefenseConversation}.
 */
type DefenseConversationProps = {
  /** The problem being defended. */
  problem: DefenseProblem
  /** Whether the hosting modal is open. */
  isOpen: boolean
  /** Closes the conversation. */
  onClose: () => void
  /** How the conversation was reached. */
  mode: DefenseConversationMode
}

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
 * The id of the saved session a mode reopens on, or undefined when it opens on the problem's newest defense.
 *
 * @param mode - How the conversation was reached.
 *
 * @returns The id of the session to reopen, or undefined.
 */
function initialSessionIdOf(mode: DefenseConversationMode): string | undefined {
  switch (mode.kind) {
    // A reopened conversation names the one session it exists for
    case 'continueSaved':
      return mode.sessionId
    // Opened on the problem, the newest saved defense is resumed instead
    case 'fromProblem':
      return undefined
    default:
      return assertNever(mode)
  }
}

/**
 * The composer's toolbar for a defense turn: only the math tools are kept, so a turn stays plain text
 * and mathematics.
 */
const DEFENSE_TOOLBAR: ToolbarConfig = {
  numberedList: false,
  bulletList: false,
  quote: false,
  heading: false,
  link: false,
  spoiler: false,
  attachment: false,
  image: false,
  emoji: false,
}

/**
 * The defense chat body: a student argues their solution to a problem and the examiner probes it turn by turn.
 * Reuses the shared rich-math editor as the composer and renders the exchange as an annotated transcript. Rendered
 * into a full-height modal panel its caller owns, so a surface already showing a modal can swap it in without
 * stacking dialogs.
 */
export function DefenseConversation({ problem, isOpen, onClose, mode }: DefenseConversationProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // The live conversation, its examiner-driven send flow, and this problem's session history
  const {
    turns,
    isThinking,
    sessions,
    initialResumeSettled,
    sessionsFailed,
    currentSessionId,
    conversationEpoch,
    send,
    stop,
    startNew,
    resume,
    deleteSession,
    rewind,
  } = useDefenseConversation(problem, t('opener'), initialSessionIdOf(mode))

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
  }, [conversationEpoch])

  // Surface a failed history load, but only while the modal is open: an empty history and a load failure
  // look identical otherwise, and the mounted-but-closed modal keeps the query running in the background
  useEffect(() => {
    if (isOpen && sessionsFailed) {
      toast.error(t('historyError'))
    }
  }, [isOpen, sessionsFailed, t])

  // Rewind is offered only on a saved conversation and never mid-turn; the whole feature is admin-gated
  // at the trigger
  const canRewind = !isThinking && currentSessionId !== null

  // Whether a fresh defense can be opened at all: only the problem carries the reference one is argued against
  const canOpenFresh = mode.kind === 'fromProblem'

  // Whether a turn has somewhere to go: an open session to append to, or the standing to open one. A reopened
  // conversation has neither until its session resumes, so it composes nothing in the meantime.
  const canCompose = canOpenFresh || currentSessionId !== null

  // Whether there's a conversation worth resetting: an open session, or a fresh one the student has
  // already started (a sent or in-flight turn past the examiner's opener). A pristine blank chat has
  // nothing to start over.
  const canStartNew = canOpenFresh && (currentSessionId !== null || turns.length > 1)

  // A reopened conversation lives off whichever saved session is open. Once none is (the named one was already
  // gone, or the open one was deleted from the history menu here) there is nothing left to continue and no
  // reference to argue a fresh defense against, so hand back to whoever opened it rather than show a composer
  // whose turns have nowhere to go. Switching to another of this problem's sessions keeps one open, so it stays.
  useEffect(() => {
    // Only a reopened conversation can outlive its session, and only a settled resume can say that it has
    if (mode.kind !== 'continueSaved' || !initialResumeSettled) {
      return
    }

    // Report it gone once nothing is open
    if (currentSessionId === null) {
      mode.onSessionGone()
    }
  }, [mode, initialResumeSettled, currentSessionId])

  // The localized label for each turn's author
  const roleLabels: Record<TurnRole, string> = {
    examiner: t('name'),
    student: t('roles.student'),
  }

  // Toasts a failed action's message: the code's central copy, else the action's generic fallback
  const showActionError = (
    errorCode: AppErrorCode | undefined,
    fallback: 'sendError' | 'rewindError' | 'deleteError'
  ) => {
    toast.error(resolveErrorMessage(errorCode, tApiErrors, { fallback: t(fallback) }))
  }

  // Sends the composed reply, unless it's empty or a turn is already in flight
  const handleSend = async () => {
    // The trimmed reply
    const content = draft.trim()

    // Bail when there's nothing to send or the examiner is still working
    if (!content || isThinking) {
      return
    }

    // Clear the composer optimistically
    setDraft('')

    // Drive the turn
    const outcome = await send(content)

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
  const handleDelete = async (sessionId: string) => {
    // Drop the session
    const outcome = await deleteSession(sessionId)

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
  const handleStop = () => {
    // Abort the reply and take back the student turn that triggered it
    const reclaimed = stop()

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
    const turn = turns[index]

    // Decide the cut point and the draft per who authored the targeted turn
    switch (turn.role) {
      // Keep the examiner turn as the new last one; nothing to restore
      case 'examiner':
        setRewindTarget({ keepThroughSequence: index, draft: '' })
        break
      // Drop the student turn, keeping the examiner turn before it, and restore the dropped text
      case 'student':
        setRewindTarget({ keepThroughSequence: index - 1, draft: turn.content })
        break
      default:
        assertNever(turn.role)
    }
  }

  // Runs the armed rewind, restoring the composer draft on success
  const confirmRewind = async () => {
    // Nothing armed
    if (rewindTarget === null) {
      return
    }

    // Truncate the conversation
    const outcome = await rewind(rewindTarget.keepThroughSequence)

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

  return (
    <>
      {/* What's being defended + session controls + close */}
      <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2.5 sm:px-5">
        {/* Who the student is talking to, and what she is */}
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-base font-bold text-foreground sm:text-lg">
            {t('name')}
          </span>
          <span className="truncate text-xs text-muted">{t('role')}</span>
        </div>

        {/* Push the controls to the trailing edge */}
        <div className="ml-auto flex items-center gap-2">
          {/* Start a fresh defense */}
          {canStartNew && (
            <Button
              variant="secondary"
              size="sm"
              onClick={startNew}
              aria-label={t('newDefense')}
              className="gap-1.5 px-2.5 text-xs"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t('newDefense')}</span>
            </Button>
          )}

          {/* Browse this problem's defenses, offered once one is saved */}
          {sessions.length > 0 && (
            <DefenseHistoryMenu
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelect={resume}
              onDelete={handleDelete}
            />
          )}

          {/* Close the conversation */}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={tModal('close')}>
            <X size={20} />
          </Button>
        </div>
      </div>

      {/* Re-readable problem statement */}
      <ProblemStrip label={t('problemStrip')} statement={problem.statement} />

      {/* The conversation so far */}
      <DefenseTranscript
        turns={turns}
        conversationKey={conversationEpoch}
        roleLabels={roleLabels}
        regionLabel={t('transcriptLabel')}
        jumpLabel={t('jumpToLatest')}
        isThinking={isThinking}
        thinkingLabel={t('thinking')}
        canRewind={canRewind}
        rewindLabel={t('rewind')}
        onRewindTurn={requestRewind}
      />

      {/* Confirmation for a rewind, before the tail is permanently dropped */}
      <ConfirmDialog
        isOpen={rewindTarget !== null}
        onClose={() => setRewindTarget(null)}
        onConfirm={confirmRewind}
        title={t('rewindTitle')}
        message={t('rewindMessage')}
        variant="danger"
      />

      {/* Composer, once there is a conversation for it to write into */}
      <div className="border-t border-foreground/10 px-4 py-3 sm:px-5">
        {canCompose ? (
          <RichMathEditor
            variant="card"
            toolbar={DEFENSE_TOOLBAR}
            value={draft}
            onChange={setDraft}
            onSend={() => void handleSend()}
            onStop={handleStop}
            autoFocus
            ref={editorRef}
            isLoading={isThinking}
            placeholder={t('placeholder')}
          />
        ) : (
          <p className="py-3 text-center text-sm text-muted">{t('libraryLoading')}</p>
        )}
      </div>
    </>
  )
}
