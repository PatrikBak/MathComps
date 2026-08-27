'use client'

import { Flag, type LucideIcon, MessageSquareQuote, MessagesSquare, StickyNote } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { memo } from 'react'

import { DefenseTargetLabel } from '@/components/features/defense/components/DefenseTargetLabel'
import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { toPlainTextPreview } from '@/components/shared/utils/string-utils'

import { type DefenseReviewConversation, describeReviewUser } from '../model/defense-review-types'

/**
 * Props for the {@link DefenseReviewCard} component.
 */
type DefenseReviewCardProps = {
  /** The conversation the card stands for. */
  conversation: DefenseReviewConversation
  /** Opens it for reading. */
  onOpen: (sessionId: string) => void
}

/**
 * One conversation in the review queue: the problem it was held against, who held it, how it opened, and every
 * mark that decides whether it is worth opening.
 *
 * The problem heads the card rather than a heading above a run of them, since the queue runs in the order the
 * conversations were last spoken to and two neighbours are rarely about the same one. Its fill is drawn from the
 * foreground rather than from a colour: the page sits on a gradient fixed to the viewport, and a neutral tint is
 * the one that reads the same wherever down the queue the card has been scrolled to.
 *
 * Held against its props, since naming the problem reads the handout index and the preview parses the opening
 * message: marking one conversation read redraws the queue, and the queue is redrawn once per conversation when
 * the reader clears a whole page of them.
 */
export const DefenseReviewCard = memo(function DefenseReviewCard({
  conversation,
  onOpen,
}: DefenseReviewCardProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Profile copy
  const tProfile = useTranslations('profile')

  // Locale-aware value formatter
  const format = useFormatter()

  // Whether anything in it has arrived since it was last read
  const isUnread = conversation.unreadTurnCount > 0

  // A glimpse of the conversation, stripped to plain text. A student message that is nothing but
  // markup strips to nothing, which reads as the same absence as never having said anything.
  const preview =
    conversation.lastStudentMessage === null
      ? ''
      : toPlainTextPreview(conversation.lastStudentMessage)

  // When it last moved, to the minute so two conversations from one day stay apart
  const lastActivityAt = format.dateTime(new Date(conversation.lastActivityAt), {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <button
      type="button"
      onClick={() => onOpen(conversation.id)}
      // Named so the queue can put focus back on whichever conversation was last open, which is not the card
      // the reader clicked once they have stepped along from it
      data-conversation-id={conversation.id}
      className={cn(
        'w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-left',
        'transition-colors hover:border-foreground/25 hover:bg-foreground/[0.07]',
        FOCUS_RING_CLASS
      )}
    >
      {/* Which problem it was held against, and when it last moved */}
      <span className="flex items-baseline gap-3">
        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
          <DefenseTargetLabel target={conversation.target} emphasis="muted" />
        </span>

        <time
          dateTime={conversation.lastActivityAt}
          className="shrink-0 text-xs tabular-nums text-muted"
        >
          {lastActivityAt}
        </time>
      </span>

      {/* Who held it, and how much of it nobody has read */}
      <span className="mt-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            isUnread ? 'bg-foreground' : 'bg-transparent'
          )}
        />

        <span
          className={cn(
            'min-w-0 truncate',
            isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {describeReviewUser(conversation.user, tProfile('defaultUser'))}
        </span>

        {isUnread && (
          <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {t('newTurns', { count: conversation.unreadTurnCount })}
          </span>
        )}
      </span>

      {/* What the student opened with */}
      <span
        className={cn(
          'mt-1 block pl-3.5 text-sm leading-relaxed text-muted',
          preview === '' ? 'italic' : 'line-clamp-2'
        )}
      >
        {preview === '' ? t('noStudentMessage') : preview}
      </span>

      {/* What the queue holds against it */}
      <span className="mt-2.5 flex items-center gap-3 pl-3.5 text-xs text-muted">
        <Mark icon={MessagesSquare} label={t('turnCount', { count: conversation.turnCount })}>
          {conversation.turnCount}
        </Mark>

        {conversation.noteCount > 0 && (
          <Mark icon={StickyNote} label={t('noteCount', { count: conversation.noteCount })}>
            {conversation.noteCount}
          </Mark>
        )}

        {conversation.hasStudentReport && (
          <Mark icon={Flag} label={t('studentReportMark')} className="text-warning" />
        )}

        {conversation.hasStudentFeedback && (
          <Mark icon={MessageSquareQuote} label={t('studentFeedbackMark')} />
        )}
      </span>
    </button>
  )
})

/**
 * Props for the {@link Mark} component.
 */
type MarkProps = {
  /** The icon standing for it. */
  icon: LucideIcon
  /** What it stands for, on hover and to assistive tech. */
  label: string
  /** The figure beside the icon, absent for a mark that is only ever there or not. */
  children?: React.ReactNode
  /** Colour for a mark that is worth picking out of the row. */
  className?: string
}

/**
 * One of the marks trailing a card, as an icon and the figure it counts.
 */
function Mark({ icon: Icon, label, children, className }: MarkProps) {
  return (
    <span className={cn('flex items-center gap-1 tabular-nums', className)} title={label}>
      {/* The icon standing for it */}
      <Icon size={13} aria-hidden="true" />

      {/* The figure, which on its own says nothing about what it counts */}
      <span aria-hidden="true">{children}</span>

      {/* What the icon says visually, for a reader that gets neither the icon nor the hover */}
      <span className="sr-only">{label}</span>
    </span>
  )
}
