'use client'

import { ChevronLeft, ChevronRight, Mail, MailOpen, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { describeUser, type UserIdentity } from '@/components/features/profile/model/user-identity'
import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'
import { STEP_KEYS } from '@/hooks/use-step-hotkeys'
import type { UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'

import { useConversationDialog } from '../hooks/use-conversation-dialog'
import type { SidePanelId } from '../hooks/use-conversation-panels'
import type { AuthorConversationsResult } from '../model/conversation-detail'
import type { ConversationListSync } from '../model/conversation-list-sync'
import { ActionLabel } from './ActionLabel'
import { ConversationDialogBody, type ConversationGrading } from './ConversationDialogBody'
import { DefenseTargetRef } from './DefenseTargetRef'

/**
 * What each item of the dialog's list is: an author's problem; one of their conversations, the list staying on it
 * while the switch shows their others; or one of their conversations in a list holding all their others too, which
 * the switch then opens as the item.
 */
type ListItems = 'problems' | 'conversations' | 'everyConversation'

/** Whether each kind of item is itself one of an author's conversations, which the dialog then starts on. */
const ITEMS_ARE_CONVERSATIONS: Record<ListItems, boolean> = {
  problems: false,
  conversations: true,
  everyConversation: true,
}

/** Whether picking a conversation on the switch opens it as the list's item, by each kind of item. */
const SWITCH_OPENS_ITEM: Record<ListItems, boolean> = {
  problems: false,
  conversations: false,
  everyConversation: true,
}

/**
 * Props for the {@link ConversationDialog} component.
 */
export type ConversationDialogProps = {
  /** Which item of the page's list is open, and every way of moving off it. */
  selection: UseSteppedSelectionResult
  /** Who held the open item's conversations; null while that is unknown. */
  author: UserIdentity | null
  /** Every conversation the author held about the open item's problem, as far as reading them has got. */
  conversationList: AuthorConversationsResult
  /**
   * The grade on the open item's problem, known as soon as the author's conversations are; null where nobody
   * grades the author on it.
   */
  grading?: ConversationGrading | null
  /** The lists the page holds conversations and their notes in. */
  listSync: ConversationListSync
  /**
   * What each item of the list is; absent where each is an author's problem, which starts on the first
   * conversation they held about it.
   */
  items?: ListItems
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
 * One conversation about one problem, read back in full, in a dialog for working through a list one item at a
 * time: a header naming whoever held it and holding the way through the list, over the conversation, their other
 * conversations about the problem, and everything read or written against it.
 *
 * The dialog itself never unmounts while the reader works through the list: stepping from one item to the next
 * swaps what is inside it, so the focus trap never re-runs and the arrow that was just pressed stays under the
 * reader's finger. The header holds its height across that swap by keeping a blank line where each name goes.
 * What is inside waits for the conversation, its author and their list. The author's name labels their turns,
 * and the grade is known once the list is: a grade tab turning up after the rest would swap out whatever panel
 * the reader was looking at.
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
  author,
  conversationList,
  grading = null,
  listSync,
  items = 'problems',
  stepActions,
  landingNoteId = null,
  initialTabId = null,
  onClosed,
}: ConversationDialogProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('conversationReview')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // Profile copy
  const tProfile = useTranslations('profile')

  // What the dialog shows, and every way of acting on it
  const {
    detail,
    conversations,
    uiState,
    panels,
    readMarking,
    noteTurnId,
    setNoteTurnId,
    selectConversation,
    handleClosed,
  } = useConversationDialog(
    selection.openId,
    conversationList,
    ITEMS_ARE_CONVERSATIONS[items],
    grading?.window ?? null,
    listSync,
    landingNoteId,
    initialTabId,
    onClosed
  )

  // The author's name, once whose item is open is known
  const authorName = author === null ? null : describeUser(author, tProfile('defaultUser'))

  // A function which shows another of the author's conversations: as the list's item where the switch opens
  // items, or else within the item open
  const showConversation = SWITCH_OPENS_ITEM[items] ? selection.open : selectConversation

  return (
    <Modal
      isOpen={selection.openId !== null}
      onClose={selection.close}
      showCloseButton={false}
      padded={false}
      tall
      focusPanelOnOpen
      className="sm:max-w-6xl 2xl:max-w-[102rem]"
      ariaLabel={
        authorName === null ? t('dialogTitle') : t('dialogTitleFor', { author: authorName })
      }
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
          <p className="truncate font-bold text-foreground">{authorName ?? '\u00a0'}</p>
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

      {/* The conversation, once it, its author and their list have arrived */}
      {detail === null || conversations === null || authorName === null ? (
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
          authorName={authorName}
          conversations={conversations}
          grading={grading}
          listSync={listSync}
          panels={panels}
          firstNewTurnId={readMarking.firstNewTurnId}
          onMarkUnreadFrom={readMarking.markUnreadFrom}
          noteTurnId={noteTurnId}
          onNoteTurnIdChange={setNoteTurnId}
          landingNoteId={landingNoteId}
          onSelectConversation={showConversation}
        />
      )}
    </Modal>
  )
}
