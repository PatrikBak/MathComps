'use client'

import { Plus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import type { ToolbarConfig } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'

import { useDefenseConversation } from '../hooks/use-defense-conversation'
import type { DefenseProblem, TurnRole } from '../model/defense-types'
import { DefenseHistoryMenu } from './DefenseHistoryMenu'
import { DefenseTranscript } from './DefenseTranscript'
import { ProblemStrip } from './ProblemStrip'

/**
 * Props for the {@link DefenseModal}.
 */
type DefenseModalProps = {
  /** The problem being defended. */
  problem: DefenseProblem
  /** Whether the modal is open. */
  isOpen: boolean
  /** Closes the modal. */
  onClose: () => void
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
 * The defense chat: a student argues their solution to a problem and the examiner probes it turn by
 * turn. Reuses the shared rich-math editor as the composer and renders the exchange as an annotated
 * transcript.
 */
export function DefenseModal({ problem, isOpen, onClose }: DefenseModalProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // The live conversation, its examiner-driven send flow, and this problem's session history
  const {
    turns,
    isThinking,
    sessions,
    currentSessionId,
    conversationEpoch,
    send,
    stop,
    startNew,
    resume,
    deleteSession,
  } = useDefenseConversation(problem, t('opener'))

  // The in-progress composer text
  const [draft, setDraft] = useState('')

  // The localized label for each turn's author
  const roleLabels: Record<TurnRole, string> = {
    examiner: t('roles.examiner'),
    student: t('roles.student'),
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
    switch (outcome) {
      // The reply landed, or a stop already reclaimed the draft: nothing to do
      case 'sent':
      case 'stopped':
        break
      // The round-trip failed: tell the student and hand their draft back to resend
      case 'failed':
        toast.error(t('sendError'))
        setDraft((current) => (current.trim() ? current : content))
        break
      // A double-tap: the in-flight turn already carries this content, so the composer stays cleared
      case 'busy':
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      padded={false}
      ariaLabel={t('title')}
      className="flex h-[100dvh] w-full flex-col sm:h-[85vh] sm:max-w-3xl"
    >
      {/* What's being defended + session controls + close */}
      <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
        {/* Title and problem name */}
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-foreground sm:text-lg">
            {t('title')}
          </div>
          <div className="truncate text-xs text-muted">{problem.title}</div>
        </div>

        {/* Push the controls to the trailing edge */}
        <div className="ml-auto flex items-center gap-2">
          {/* Start a fresh defense, offered only once the current one has real content */}
          {currentSessionId !== null && (
            <Button
              variant="secondary"
              size="sm"
              onClick={startNew}
              aria-label={t('newDefense')}
              className="gap-1.5"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">{t('newDefense')}</span>
            </Button>
          )}

          {/* Browse past defenses, offered when there's a saved one other than the current */}
          {sessions.some((session) => session.id !== currentSessionId) && (
            <DefenseHistoryMenu
              sessions={sessions}
              currentSessionId={currentSessionId}
              onSelect={resume}
              onDelete={deleteSession}
            />
          )}

          {/* Close the modal */}
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
        thinkingLongLabel={t('thinkingLong')}
      />

      {/* Composer */}
      <div className="border-t border-foreground/10 px-4 py-3 sm:px-5">
        <RichMathEditor
          variant="card"
          toolbar={DEFENSE_TOOLBAR}
          value={draft}
          onChange={setDraft}
          onSend={() => void handleSend()}
          onStop={handleStop}
          autoFocus
          isLoading={isThinking}
          placeholder={t('placeholder')}
        />
      </div>
    </Modal>
  )
}
