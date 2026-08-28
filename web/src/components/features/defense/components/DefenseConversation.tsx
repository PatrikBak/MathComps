'use client'

import { useAuth } from '@clerk/nextjs'
import { Plus, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { resolveHandoutProblemRef } from '@/components/features/handouts/handout-problem-ref'
import { CompetitionClock } from '@/components/features/hosted-competitions/components/CompetitionClock'
import type { AreaEntry } from '@/components/features/hosted-competitions/model/hosted-competition-state'
import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { MATHILDA_NAME } from '@/constants/mathilda'
import type { Locale } from '@/i18n/i18n'

import { useDefenseCompetitionMode } from '../hooks/use-defense-competition-mode'
import { useDefenseConversation } from '../hooks/use-defense-conversation'
import { useDefenseFeedback } from '../hooks/use-defense-feedback'
import { useDefenseTurnControls } from '../hooks/use-defense-turn-controls'
import { useMathildaConsent } from '../hooks/use-mathilda-consent'
import { resolveComposerState } from '../model/defense-composer-state'
import { defenseDraftStorageKey, handoutTargetOf } from '../model/defense-target'
import type { DefenseOpening, DefenseProblem, TurnRole } from '../model/defense-types'
import { DefenseComposer } from './DefenseComposer'
import { DefenseFeedbackDialogs } from './DefenseFeedbackDialogs'
import { DefenseFeedbackPrompt } from './DefenseFeedbackPrompt'
import { DefenseHistoryMenu } from './DefenseHistoryMenu'
import { DefenseTranscript } from './DefenseTranscript'
import { ProblemStrip } from './ProblemStrip'

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
  /**
   * Which conversation to open on. Stable for the life of the mount: it is opened once, so showing a
   * different defense means mounting a new conversation.
   */
  opening: DefenseOpening
  /**
   * The competition entry this defense is being argued inside, or null outside a competition.
   *
   * Inside one the conversation is read-only past what has been said: every attempt stays part of the
   * record of what the student argued under their entry.
   */
  competition: AreaEntry | null
}

/**
 * The shortest conversation there is an outcome to answer for: the examiner's opener, the student arguing
 * something, and the reply to it. Anything shorter has not been a defense yet.
 */
const TURNS_WORTH_ANSWERING_FOR = 3

/**
 * The defense chat body: a student argues their solution to a problem and the examiner probes it turn by turn.
 * Reuses the shared rich-math editor as the composer and renders the exchange as an annotated transcript. Rendered
 * into a full-height modal panel its caller owns, so a surface already showing a modal can swap it in without
 * stacking dialogs.
 *
 * What a defense is argued against is resolved from the target it names, a handout's environment or a
 * competition's problem, so starting a fresh one takes the target and nothing else, wherever the
 * conversation was opened from.
 */
export function DefenseConversation({
  problem,
  isOpen,
  onClose,
  opening,
  competition,
}: DefenseConversationProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // The active locale
  const locale = useLocale() as Locale

  // Auth state
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()

  // The student's standing acknowledgement of what talking to Mathilda entails, and the call that records it
  const consent = useMathildaConsent()

  // The live conversation, its examiner-driven send flow, and this problem's session history. The greeting is
  // read here so the chat opens on it before a session exists; the backend seeds its own copy as the saved
  // conversation's first turn, so `defense.opener` and the backend's `defense-copy.json` must stay in step.
  const {
    turns,
    isThinking,
    sessions,
    limits,
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
  } = useDefenseConversation(problem, t('opener'), opening)

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
    draftStorageKey: defenseDraftStorageKey(problem.target),
  })

  // Where this conversation stands against the entry's clock
  const competitionMode = useDefenseCompetitionMode(competition, turns)

  // Whether this defense is being argued inside a competition, which is what settles its transcript
  const isCompetition = competition !== null

  // Surface a failed history load, but only while the modal is open: an empty history and a load failure
  // look identical otherwise, and the mounted-but-closed modal keeps the query running in the background
  useEffect(() => {
    if (isOpen && sessionsFailed) {
      toast.error(t('historyError'))
    }
  }, [isOpen, sessionsFailed, t])

  // Feedback, on one reply or on the whole conversation, is offered only on a saved one and never mid-turn;
  // a session id only ever names one the signed-in viewer owns, so there's no one else's to speak about.
  // Unknown caps mean the history hasn't arrived, and a report would have no cap to hold its comment to
  const canGiveFeedback = !isThinking && currentSessionId !== null && limits !== null

  // Rewinding takes the same conditions and one more, since it drops turns rather than speaking about them:
  // a competition's transcript is the thing that later gets graded, so nothing inside one may rewrite it
  const canRewind = canGiveFeedback && !isCompetition

  // Whether the conversation has enough behind it to be worth summing up, or was already summed up, which
  // keeps a standing answer reachable to revise however short a rewind has left the conversation.
  const canAnswer =
    canGiveFeedback && (turns.length >= TURNS_WORTH_ANSWERING_FOR || currentFeedback !== null)

  // Whether a turn has somewhere to go. A conversation opened on a named defense writes nothing until its resume
  // settles: a turn sent before it would open a second defense beside the one being continued.
  const canCompose = opening.kind !== 'named' || initialResumeSettled

  // How many more replies the conversation has room for, or null while the caps are unknown. A reply still in
  // flight counts against it: it is written the moment it's sent, whatever the examiner then makes of it
  const repliesLeft =
    limits === null
      ? null
      : limits.maxTurnsPerSession - turns.filter((turn) => turn.role === 'candidate').length

  // The handout environment behind this problem, absent when it is not a handout problem at all
  const handoutTarget = handoutTargetOf(problem.target)

  // Where this reader's language reaches the problem, absent when it doesn't carry the handout
  const problemLink =
    handoutTarget === null ? null : (resolveHandoutProblemRef(handoutTarget, locale)?.link ?? null)

  // Whether a fresh defense has anything to be argued against: what a handout problem is measured against
  // is published per language, so a locale that doesn't carry it reaches none, and a competition problem
  // names no handout to reach
  const canStartFresh = problemLink !== null

  // Whether there's a conversation worth resetting: an open session, or a fresh one the student has
  // already started (a sent or in-flight turn past the examiner's opener). A pristine blank chat has
  // nothing to start over.
  const canStartNew =
    canStartFresh && !isCompetition && (currentSessionId !== null || turns.length > 1)

  // The localized label for each turn's author
  const roleLabels: Record<TurnRole, string> = {
    examiner: MATHILDA_NAME,
    candidate: t('roles.student'),
  }

  return (
    <>
      {/* The header: who is examining, and the conversation's controls */}
      <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2.5 sm:px-5">
        {/* Who the student is talking to. What she is gets said where there is room for the whole of it:
            truncated to a letter and an ellipsis it says nothing and still takes the width */}
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-base font-bold text-foreground sm:text-lg">
            {MATHILDA_NAME}
          </span>
          <span className="hidden truncate text-xs text-muted sm:inline">{t('role')}</span>
        </div>

        {/* How long the entry has left, which the page behind this modal is no longer there to say */}
        {competition?.kind === 'sat' && (
          <CompetitionClock
            endsAt={competition.endsAt}
            now={competitionMode.now}
            wasHandedIn={competition.wasHandedIn}
          />
        )}

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
              onDelete={isCompetition ? null : turn.removeSession}
            />
          )}

          {/* Close the conversation */}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={tModal('close')}>
            <X size={20} />
          </Button>
        </div>
      </div>

      {/* Re-readable problem statement */}
      <ProblemStrip statement={problem.statement} />

      {/* The conversation so far */}
      <DefenseTranscript
        turns={turns}
        conversationKey={conversationEpoch}
        roleLabels={roleLabels}
        isThinking={isThinking}
        reports={reports}
        canGiveFeedback={canGiveFeedback}
        canRewind={canRewind}
        onRewindTurn={turn.requestRewind}
        onReportTurn={report.open}
        dividerBeforeTurn={
          competitionMode.firstUncountedTurnId === null
            ? null
            : {
                turnId: competitionMode.firstUncountedTurnId,
                label: t('competitionClockDivider'),
              }
        }
        unreadMark={null}
        // A rejected draft is what a guard kept from the student, so their own view never offers one
        draftsMark={null}
        // How long the examiner took is tuning data, and reads to a student as an apology for the wait
        turnDurationsMs={null}
        footer={
          canAnswer && (
            <DefenseFeedbackPrompt isAnswered={currentFeedback !== null} onOpen={answer.open} />
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

      {/* Everything the student can say about the conversation, and the questions before any of it comes
          off again */}
      <DefenseFeedbackDialogs
        report={report}
        answer={answer}
        currentFeedback={currentFeedback}
        limits={limits}
        isCompetition={isCompetition}
      />

      {/* Composer, once there is a conversation for it to write into */}
      <div className="border-t border-foreground/10 px-4 py-3 sm:px-5">
        {/* What sending now costs, said where the sending happens. One line and no surface: the clock in
            the header and the line across the transcript have both already said the entry is closed, so a
            filled block repeating it a third time is a standing apology sat on top of the composer */}
        {competitionMode.hasClockExpired && (
          <p className="mb-2 text-xs text-muted">{t('competitionClockSpent')}</p>
        )}

        <DefenseComposer
          state={resolveComposerState({
            isConversationReady: canCompose,
            isAuthSettled: isAuthLoaded,
            // Undefined until the account settles, which `isAuthSettled` is the answer to
            isSignedIn: isSignedIn === true,
            isConsentLoading: consent.isLoading,
            hasConsented: consent.hasConsented,
            isThinking,
            repliesLeft,
          })}
          draft={turn.draft}
          onDraftChange={turn.setDraft}
          onSend={() => void turn.sendDraft()}
          onStop={turn.stopReply}
          editorRef={turn.editorRef}
          isThinking={isThinking}
          maxCharacters={limits?.maxCandidateChars}
          onAcceptConsent={consent.accept}
          isAcceptingConsent={consent.isAccepting}
        />
      </div>
    </>
  )
}
