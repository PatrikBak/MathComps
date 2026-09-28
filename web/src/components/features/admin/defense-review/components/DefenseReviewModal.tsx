'use client'

import { Mail, MailOpen, MailPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ConversationModal } from '@/components/features/admin/components/ConversationModal'
import { describeUser } from '@/components/features/admin/model/user-identity'
import { Button } from '@/components/shared/components/Button'
import { useKeyedState } from '@/hooks/use-keyed-state'

import { useDefenseReviewDetail } from '../hooks/use-defense-review-detail'
import { useDefenseReviewPanels } from '../hooks/use-defense-review-panels'
import { useDefenseReviewReadMarking } from '../hooks/use-defense-review-read-marking'
import type { MarkUnreadFrom } from '../hooks/use-defense-review-read-state'
import type { UseDefenseReviewSelectionResult } from '../hooks/use-defense-review-selection'
import { NEXT_UNREAD_KEY } from '../model/defense-review-stepping'
import { ActionLabel } from './ActionLabel'
import { DefenseReviewModalBody } from './DefenseReviewModalBody'
import { DefenseTargetRef } from './DefenseTargetRef'

/**
 * Props for the {@link DefenseReviewModal} component.
 */
type DefenseReviewModalProps = {
  /** Which conversation is being read, and every way of moving off it. */
  selection: UseDefenseReviewSelectionResult
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId: string | null
  /** Stamps a conversation as read. */
  onMarkRead: (sessionId: string) => void
  /** Leaves a conversation unread. */
  onMarkUnread: (sessionId: string) => void
  /** {@link MarkUnreadFrom}. */
  onMarkUnreadFrom: MarkUnreadFrom
  /** Runs once the dialog has finished leaving. */
  onClosed: () => void
}

/**
 * One conversation, read back in full.
 *
 * The read toggle carries words beside its envelope wherever the header has room for them: an envelope on its
 * own says nothing about which way it is about to go.
 */
export function DefenseReviewModal({
  selection,
  landingNoteId,
  onMarkRead,
  onMarkUnread,
  onMarkUnreadFrom,
  onClosed,
}: DefenseReviewModalProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Profile copy
  const tProfile = useTranslations('profile')

  // The conversation itself
  const { detail, uiState } = useDefenseReviewDetail(selection.openId)

  // How much of it stands on screen at once, and which part the reader is looking at
  const panels = useDefenseReviewPanels(landingNoteId)

  // Reading it, and where the last pass through it stopped
  const readMarking = useDefenseReviewReadMarking(
    detail,
    selection.openId,
    onMarkRead,
    onMarkUnread,
    onMarkUnreadFrom
  )

  // Which reply a new note will stand against, held above the notes tab because the transcript marks it too
  const [noteTurnId, setNoteTurnId] = useKeyedState<string | null>(selection.openId, null)

  // The student's name, once the conversation has arrived
  const student = detail === null ? null : describeUser(detail.user, tProfile('defaultUser'))

  // A function which wipes the dialog session once the dialog has finished leaving
  const handleClosed = () => {
    // Back on the conversation for the next open
    panels.reset()

    // Forget every conversation this dialog session went through
    readMarking.reset()

    // Report the dialog as gone
    onClosed()
  }

  return (
    <ConversationModal
      selection={selection}
      ariaLabel={student === null ? t('detailTitle') : t('detailTitleFor', { student })}
      title={student}
      subtitle={
        detail === null ? null : <DefenseTargetRef target={detail.target} emphasis="muted" />
      }
      actions={
        // Whether it counts as read
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
      }
      stepActions={
        // Past everything already read
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 px-2"
          aria-keyshortcuts={NEXT_UNREAD_KEY}
          disabled={!selection.canStepUnread}
          onClick={selection.stepUnread}
        >
          <MailPlus size={16} aria-hidden="true" />
          <ActionLabel>{t('nextUnread')}</ActionLabel>
        </Button>
      }
      body={
        detail === null ? null : (
          <DefenseReviewModalBody
            detail={detail}
            panels={panels}
            firstNewTurnId={readMarking.firstNewTurnId}
            noteTurnId={noteTurnId}
            landingNoteId={landingNoteId}
            onMarkUnreadFrom={readMarking.markUnreadFrom}
            onNoteTurnIdChange={setNoteTurnId}
          />
        )
      }
      uiState={uiState}
      failedMessage={t('detailFailed')}
      onClosed={handleClosed}
    />
  )
}
