'use client'

import { useAuth } from '@clerk/nextjs'
import { Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { LoginButton } from '@/components/login/LoginButton'
import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { FeedbackDialog, toFeedbackOptions } from '@/components/shared/components/FeedbackDialog'
import type { ToolbarConfig } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'

import { useDefenseConversation } from '../hooks/use-defense-conversation'
import { useDefenseFeedback } from '../hooks/use-defense-feedback'
import { useDefenseTurnControls } from '../hooks/use-defense-turn-controls'
import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  OUTCOME_KEYS,
  REPORT_CATEGORY_KEYS,
} from '../model/defense-feedback-options'
import type { DefenseProblem, TurnRole } from '../model/defense-types'
import { DefenseFeedbackPrompt } from './DefenseFeedbackPrompt'
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
 * The id of the saved session a mode reopens on, or undefined when it opens on the problem's newest defense.
 *
 * @param mode - How the conversation was reached.
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
 * The shortest conversation there is an outcome to answer for: the examiner's opener, the student arguing
 * something, and the reply to it. Anything shorter has not been a defense yet.
 */
const TURNS_WORTH_ANSWERING_FOR = 3

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

  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // Auth state
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()

  // The live conversation, its examiner-driven send flow, and this problem's session history
  const {
    turns,
    isThinking,
    sessions,
    initialResumeSettled,
    sessionsFailed,
    currentSessionId,
    currentFeedback,
    reports,
    conversationEpoch,
    send,
    stop,
    startNew,
    resume,
    setFeedback,
    setReport,
    clearReport,
    deleteSession,
    rewind,
  } = useDefenseConversation(problem, t('opener'), initialSessionIdOf(mode))

  // Reporting one of the examiner's replies and answering for the conversation as a whole, either of which
  // can be taken back again
  const { report, answer } = useDefenseFeedback({
    currentSessionId,
    currentFeedback,
    reports,
    setReport,
    clearReport,
    setFeedback,
  })

  // The composer, and the controls that act on the conversation around it
  const turn = useDefenseTurnControls({
    turns,
    isThinking,
    conversationEpoch,
    send,
    stop,
    rewind,
    deleteSession,
  })

  // Surface a failed history load, but only while the modal is open: an empty history and a load failure
  // look identical otherwise, and the mounted-but-closed modal keeps the query running in the background
  useEffect(() => {
    if (isOpen && sessionsFailed) {
      toast.error(t('historyError'))
    }
  }, [isOpen, sessionsFailed, t])

  // A turn's own controls are offered only on a saved conversation and never mid-turn; a session id only
  // ever names one the signed-in viewer owns, so there's no one else's conversation to act on
  const canAct = !isThinking && currentSessionId !== null

  // Whether the conversation has enough behind it to be worth summing up, or was already summed up, which
  // keeps a standing answer reachable to revise however short a rewind has left the conversation.
  const canAnswer =
    canAct && (turns.length >= TURNS_WORTH_ANSWERING_FOR || currentFeedback !== null)

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
    candidate: t('roles.student'),
  }

  return (
    <>
      {/* The header: who is examining, and the conversation's controls */}
      <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2.5 sm:px-5">
        {/* Who the student is talking to */}
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-base font-bold text-foreground sm:text-lg">
            {t('name')}
          </span>
          <span className="truncate text-xs text-muted">{t('role')}</span>
        </div>

        {/* The conversation's controls, at the trailing edge */}
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
              onDelete={turn.removeSession}
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
        reports={reports}
        canAct={canAct}
        rewindLabel={t('rewind')}
        reportLabel={t('report')}
        reportedLabel={t('reported')}
        onRewindTurn={turn.requestRewind}
        onReportTurn={report.open}
        newSince={null}
        unreadMark={null}
        // A rejected draft is what a guard kept from the student, so their own view never offers one
        draftsMark={null}
        footer={
          canAnswer && (
            <DefenseFeedbackPrompt
              isAnswered={currentFeedback !== null}
              answeredLabel={t('feedbackGiven')}
              questionLabel={t('feedbackTitle')}
              onOpen={answer.open}
            />
          )
        }
      />

      {/* Confirmation for a rewind, before the tail is permanently dropped */}
      <ConfirmDialog
        isOpen={turn.rewindTarget !== null}
        onClose={turn.cancelRewind}
        onConfirm={turn.confirmRewind}
        title={t('rewindTitle')}
        message={t('rewindMessage')}
        variant="danger"
      />

      {/* Every way one of the examiner's replies went wrong */}
      <FeedbackDialog
        isOpen={report.isOpen}
        onClose={report.close}
        onRemove={report.standing === undefined ? null : report.requestRemoval}
        choice={{
          selection: 'multiple',
          initialValues: report.standing?.categories ?? [],
          onSubmit: report.submit,
        }}
        requiresComment="other"
        requiresCommentHint={t('requiresCommentHint')}
        title={t('reportTitle')}
        options={toFeedbackOptions(REPORT_CATEGORY_KEYS, t)}
        initialComment={report.standing?.comment ?? ''}
        commentLabel={t('reportCommentLabel')}
        commentMaxLength={FEEDBACK_COMMENT_MAX_LENGTH}
        isPending={report.isSubmitting}
      />

      {/* The question before a report comes off, since taking it off drops something the student said */}
      <ConfirmDialog
        isOpen={report.isRemoving}
        onClose={report.cancelRemoval}
        onConfirm={report.confirmRemoval}
        title={t('removeReportTitle')}
        message={t('removeReportMessage')}
        variant="danger"
      />

      {/* What the student makes of the conversation as a whole */}
      <FeedbackDialog
        isOpen={answer.isOpen}
        onClose={answer.close}
        onRemove={currentFeedback === null ? null : answer.requestRemoval}
        choice={{
          selection: 'single',
          initialValue: currentFeedback?.outcome ?? null,
          onSubmit: answer.submit,
        }}
        requiresComment="somethingElse"
        requiresCommentHint={t('requiresCommentHint')}
        title={t('feedbackTitle')}
        options={toFeedbackOptions(OUTCOME_KEYS, t)}
        initialComment={currentFeedback?.comment ?? ''}
        commentLabel={t('feedbackCommentLabel')}
        commentMaxLength={FEEDBACK_COMMENT_MAX_LENGTH}
        isPending={answer.isSubmitting}
      />

      {/* And the same for the answer the conversation as a whole carries */}
      <ConfirmDialog
        isOpen={answer.isRemoving}
        onClose={answer.cancelRemoval}
        onConfirm={answer.confirmRemoval}
        title={t('removeFeedbackTitle')}
        message={t('removeFeedbackMessage')}
        variant="danger"
      />

      {/* Composer, once there is a conversation for it to write into */}
      <div className="border-t border-foreground/10 px-4 py-3 sm:px-5">
        {!canCompose || !isAuthLoaded ? (
          <p className="py-3 text-center text-sm text-muted">{t('libraryLoading')}</p>
        ) : !isSignedIn ? (
          <div className="flex flex-col items-center gap-3 py-3 text-center">
            {/* Why there is nothing to write into */}
            <p className="text-sm text-muted">{t('loginPrompt')}</p>

            {/* And the way to fix that */}
            <LoginButton />
          </div>
        ) : (
          <RichMathEditor
            variant="card"
            toolbar={DEFENSE_TOOLBAR}
            value={turn.draft}
            onChange={turn.setDraft}
            onSend={() => void turn.sendDraft()}
            onStop={turn.stopReply}
            autoFocus
            ref={turn.editorRef}
            isLoading={isThinking}
            placeholder={t('placeholder')}
          />
        )}
      </div>
    </>
  )
}
