'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { DefenseTranscript } from '@/components/features/defense/components/DefenseTranscript'
import { ProblemBand } from '@/components/features/defense/components/ProblemBand'
import { findFirstUncountedTurnId } from '@/components/features/defense/hooks/use-defense-competition-mode'
import { MATHILDA_NAME } from '@/constants/mathilda'

import { useAdminTranscript } from '../hooks/use-admin-transcript'
import type { AdminConversation } from '../model/admin-conversation'
import { StudentVerdict } from './StudentVerdict'
import { TurnAttemptsModal } from './TurnAttemptsModal'

/**
 * Props for the {@link TranscriptPane} component.
 */
type TranscriptPaneProps = {
  /** The conversation being read. */
  conversation: AdminConversation
  /** Whatever stands above the problem. */
  aboveStatement: ReactNode
  /** The first turn left to read since the reader's last pass; null while nothing marks one. */
  firstNewTurnId: string | null
  /** When what the student says stops counting toward a grade; null where nothing stops it. */
  countsUntil: string | null
  /** Picks the conversation up again from one of its turns. */
  onMarkUnreadFrom: (turnId: string) => void
  /** Starts a note about one of the examiner's replies. */
  onStartNote: (turnId: string) => void
  /** The reply a note is being written against; null when none is. */
  pointedAtTurnId: string | null
}

/**
 * A conversation as an admin reads it: the problem, re-readable above it, and every turn with Mathilda's
 * replies numbered, so anything written about one can name it. A turn says how long it took its author wherever
 * that was measured, a reply that kept its drafts opens them, and what the student said about it closes the
 * conversation. Where the student is graded, a line marks where their words stop counting. Nothing in it can be
 * rewound or reported, since those are the student's own.
 */
export function TranscriptPane({
  conversation,
  aboveStatement,
  firstNewTurnId,
  countsUntil,
  onMarkUnreadFrom,
  onStartNote,
  pointedAtTurnId,
}: TranscriptPaneProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  // Notes copy
  const tNotes = useTranslations('admin.notes')

  // Where the reading stops, drawn only where it has read turns above it: over the whole conversation it
  // would separate nothing, and it would land where a rule between the statement and the transcript goes
  const newSince =
    firstNewTurnId === null || firstNewTurnId === conversation.turns[0]?.id
      ? null
      : { turnId: firstNewTurnId, label: t('unreadDivider') }

  // The first turn said after the student's words stopped counting, null where none was
  const firstUncountedTurnId =
    countsUntil === null ? null : findFirstUncountedTurnId(conversation.turns, countsUntil)

  // Where the student's words stop counting, drawn above the first turn past it
  const countsUntilLine =
    firstUncountedTurnId === null
      ? null
      : { turnId: firstUncountedTurnId, label: t('countsUntilDivider') }

  // What each turn carries beyond its text, and the drafts being read
  const { reports, draftCounts, turnDurationsMs, openDrafts, readDrafts, closeDrafts } =
    useAdminTranscript(conversation)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Whatever stands above the problem */}
      {aboveStatement}

      {/* The problem, re-readable above the conversation */}
      <ProblemBand statement={conversation.statement} height="shared" />

      {/* What was said */}
      <DefenseTranscript
        turns={conversation.turns}
        conversationKey={conversation.id}
        reports={reports}
        // How each reply was arrived at, offered only on the replies that kept their drafts
        draftsMark={{
          label: (draftCount) => t('attempts.open', { draftCount }),
          draftCounts,
          onOpen: readDrafts,
        }}
        turnDurationsMs={turnDurationsMs}
        footer={
          <StudentVerdict
            feedback={conversation.feedback}
            reports={conversation.reports}
            turns={conversation.turns}
          />
        }
        // At the first turn left to read, which is the top where nothing marks one
        openingTurnId={firstNewTurnId ?? conversation.turns[0]?.id ?? null}
        // Where the words stop counting, then where the reading stopped, stacked in that order on a shared turn
        dividers={[countsUntilLine, newSince].filter((divider) => divider !== null)}
        // Where the next pass through it starts is the reader's to move, reply by reply
        unreadMark={{ label: t('markUnreadFromTurn'), onMark: onMarkUnreadFrom }}
        // A note about one of the examiner's replies can be started from the reply itself
        noteMark={{ label: tNotes('writeOnTurn'), onMark: onStartNote }}
        pointedAtTurnId={pointedAtTurnId}
        roleLabels={{ examiner: MATHILDA_NAME, candidate: t('student') }}
        isThinking={false}
        canGiveFeedback={false}
        canRewind={false}
        onRewindTurn={() => undefined}
        onReportTurn={() => undefined}
        showReplyNumbers
      />

      {/* Whichever reply's drafts are being read, over whatever layout is underneath */}
      <TurnAttemptsModal attempts={openDrafts} onClose={closeDrafts} />
    </div>
  )
}
