'use client'

import { ChevronLeft, ChevronRight, Mail, MailOpen, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { describeUser } from '@/components/features/admin/model/user-identity'
import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'
import { STEP_KEYS } from '@/hooks/use-step-hotkeys'
import type { UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'

import { useConversationDialog } from '../hooks/use-conversation-dialog'
import type { SidePanelId } from '../hooks/use-conversation-panels'
import type { StudentProblem } from '../hooks/use-student-conversations'
import { ActionLabel } from './ActionLabel'
import { ConversationDialogBody } from './ConversationDialogBody'
import { DefenseTargetRef } from './DefenseTargetRef'

/**
 * Props for the {@link ConversationDialog} component.
 */
type ConversationDialogProps = {
  /** Which item of the page's list is open, and every way of moving off it. */
  selection: UseSteppedSelectionResult
  /** The student and problem the open item is about; null while that is unknown. */
  studentProblem: StudentProblem | null
  /**
   * Whether each item of the list is itself one of a student's conversations, which the dialog then starts on;
   * absent where each is a student's problem, which starts on the first conversation they held about it.
   */
  itemsAreConversations?: boolean
  /** Further ways through the list, standing after the step forward. */
  stepActions?: ReactNode
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId?: string | null
  /** The part the dialog's first opening starts on; null for the conversation. */
  initialTabId?: SidePanelId | null
  /**
   * Runs once the dialog has finished leaving, after focus has gone back to whatever stands for the item the
   * reader ended on, so it can send focus somewhere else.
   */
  onClosed?: () => void
}

/**
 * One student's conversation about one problem, read back in full, in a dialog for working through a list one
 * item at a time: a header naming the student and holding the way through the list, over the conversation, the
 * student's other conversations about the problem, and everything read or written against it.
 *
 * The dialog itself never unmounts while the reader works through the list: stepping from one item to the next
 * swaps what is inside it, so the focus trap never re-runs and the arrow that was just pressed stays under the
 * reader's finger. The header holds its height across that swap by keeping a blank line where each name goes.
 * What is inside waits for both the conversation and the student's list, since the list says whether there is a
 * grade, and a grade tab turning up after the rest would swap out whatever panel the reader was looking at.
 *
 * It opens with focus on the panel and on no control at all: the transcript's scroll region takes no focus of its
 * own, and left to itself the dialog lands on the first control in the header, which a reader paging with the
 * space bar would then press.
 *
 * The read toggle carries words beside its envelope wherever the header has room for them: an envelope on its
 * own says nothing about which way it is about to go.
 */
export function ConversationDialog({
  selection,
  studentProblem,
  itemsAreConversations = false,
  stepActions,
  landingNoteId = null,
  initialTabId = null,
  onClosed,
}: ConversationDialogProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // Profile copy
  const tProfile = useTranslations('profile')

  // What the dialog shows, and every way of acting on it
  const {
    detail,
    studentConversations,
    uiState,
    panels,
    readMarking,
    noteTurnId,
    setNoteTurnId,
    selectConversation,
    changeGrade,
    handleClosed,
  } = useConversationDialog(
    selection.openId,
    studentProblem,
    itemsAreConversations,
    landingNoteId,
    initialTabId,
    onClosed
  )

  // The student's name, once whose item is open is known
  const student =
    studentProblem === null ? null : describeUser(studentProblem.user, tProfile('defaultUser'))

  return (
    <Modal
      isOpen={selection.openId !== null}
      onClose={selection.close}
      showCloseButton={false}
      padded={false}
      tall
      focusPanelOnOpen
      className="sm:max-w-6xl 2xl:max-w-[102rem]"
      ariaLabel={student === null ? t('dialogTitle') : t('dialogTitleFor', { student })}
      onClosed={handleClosed}
    >
      {/* The header: who and what, whether it is read, and the way through the list */}
      <header
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-foreground/10',
          'px-4 py-2.5 sm:flex-nowrap sm:px-5'
        )}
      >
        {/* Who and what, opted out of the hyphenation the page turns on globally */}
        <div className="w-full min-w-0 hyphens-none sm:w-auto sm:flex-1" aria-live="polite">
          <p className="truncate font-bold text-foreground">{student ?? '\u00a0'}</p>
          <p className="flex items-baseline gap-2 text-xs text-muted">
            {detail === null ? (
              <span>&nbsp;</span>
            ) : (
              <DefenseTargetRef target={detail.target} emphasis="muted" />
            )}
          </p>
        </div>

        {/* Whether it counts as read */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 px-2"
          onClick={readMarking.toggleRead}
        >
          {readMarking.isRead ? (
            <MailOpen size={16} aria-hidden="true" />
          ) : (
            <Mail size={16} aria-hidden="true" />
          )}
          <ActionLabel>{readMarking.isRead ? t('markUnread') : t('markRead')}</ActionLabel>
        </Button>

        {/* The way through the list, in the order the list shows it */}
        <div className="mx-auto flex shrink-0 items-center gap-1 text-xs text-muted sm:mx-0">
          {/* Back one */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('previous')}
            aria-keyshortcuts={STEP_KEYS.previous}
            disabled={!selection.canStep(-1)}
            onClick={() => selection.step(-1)}
          >
            <ChevronLeft size={16} />
          </Button>

          {/* Where it sits in the list */}
          {selection.position !== null && (
            <span className="tabular-nums">
              {t('position', {
                index: selection.position.index,
                total: selection.position.total,
              })}
            </span>
          )}

          {/* On one */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('next')}
            aria-keyshortcuts={STEP_KEYS.next}
            disabled={!selection.canStep(1)}
            onClick={() => selection.step(1)}
          >
            <ChevronRight size={16} />
          </Button>

          {/* Any further way through */}
          {stepActions}
        </div>

        {/* Out of the dialog. Last of the controls, so a narrow header wraps it to the far end of their row */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto sm:ml-0"
          aria-label={tActions('close')}
          onClick={selection.close}
        >
          <X size={16} />
        </Button>
      </header>

      {/* The conversation, once it and the student's list have arrived */}
      {detail === null || studentConversations === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <FetchStatePlaceholder
            uiState={uiState}
            className="flex flex-col items-center gap-2 text-center"
            // A conversation that arrived empty reads the same way as one still on its way
            empty={<LoadingSpinner />}
            failed={<p className="text-sm text-muted">{t('detailFailed')}</p>}
          />
        </div>
      ) : (
        <ConversationDialogBody
          detail={detail}
          studentConversations={studentConversations}
          panels={panels}
          firstNewTurnId={readMarking.firstNewTurnId}
          onMarkUnreadFrom={readMarking.markUnreadFrom}
          noteTurnId={noteTurnId}
          onNoteTurnIdChange={setNoteTurnId}
          landingNoteId={landingNoteId}
          onSelectConversation={selectConversation}
          onChangeGrade={changeGrade}
        />
      )}
    </Modal>
  )
}
