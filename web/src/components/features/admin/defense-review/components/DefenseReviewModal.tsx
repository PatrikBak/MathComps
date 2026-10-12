'use client'

import { MailPlus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ActionLabel } from '@/components/features/conversation-review/components/ActionLabel'
import { ConversationDialog } from '@/components/features/conversation-review/components/ConversationDialog'
import { useConversationDetail } from '@/components/features/conversation-review/hooks/use-conversation-detail'
import { toSessionTarget } from '@/components/features/defense/model/defense-target'
import { Button } from '@/components/shared/components/Button'

import { useStudentConversations } from '../../conversation/hooks/use-student-conversations'
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

  // Every conversation the student held about the problem, and their grading
  const conversationList = useStudentConversations(
    opened === null ? null : { user: opened.user, target: toSessionTarget(opened.target) }
  )

  return (
    <ConversationDialog
      selection={selection}
      author={opened?.user ?? null}
      conversationList={conversationList}
      items="conversations"
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
