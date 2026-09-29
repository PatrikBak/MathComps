'use client'

import { MailPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'

import { ActionLabel } from '../../conversation/components/ActionLabel'
import { ConversationDialog } from '../../conversation/components/ConversationDialog'
import { useConversationDetail } from '../../conversation/hooks/use-conversation-detail'
import type { UseDefenseReviewSelectionResult } from '../hooks/use-defense-review-selection'
import { NEXT_UNREAD_KEY } from '../model/defense-review-stepping'

/**
 * Props for the {@link DefenseReviewModal} component.
 */
type DefenseReviewModalProps = {
  /** Which conversation of the queue is open, and every way of moving off it. */
  selection: UseDefenseReviewSelectionResult
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId: string | null
  /** Runs once the dialog has finished leaving. */
  onClosed: () => void
}

/**
 * The conversation opened from the queue, read back in full, with the student's other conversations about the
 * problem a switch away. Switching to one of them leaves the queue where it was.
 */
export function DefenseReviewModal({
  selection,
  landingNoteId,
  onClosed,
}: DefenseReviewModalProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // The conversation opened from the queue, which names the student and the problem
  const { detail: opened } = useConversationDetail(selection.openId)

  return (
    <ConversationDialog
      selection={selection}
      studentProblem={opened === null ? null : { user: opened.user, target: opened.target }}
      itemsAreConversations
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
      landingNoteId={landingNoteId}
      onClosed={onClosed}
    />
  )
}
