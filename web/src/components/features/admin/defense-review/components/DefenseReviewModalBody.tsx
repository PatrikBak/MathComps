'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { ConversationPanes } from '@/components/features/admin/components/ConversationPanes'
import { ReferencePane } from '@/components/features/admin/components/ReferencePane'
import { TranscriptPane } from '@/components/features/admin/components/TranscriptPane'
import type { UseConversationPanelsResult } from '@/components/features/admin/hooks/use-conversation-panels'
import { indexReports } from '@/components/features/defense/model/defense-conversation-model'

import type { DefenseReviewPanelId } from '../hooks/use-defense-review-panels'
import { useNoteOnReply } from '../hooks/use-note-on-reply'
import type { DefenseReviewDetail, DefenseTurnAttempt } from '../model/defense-review-types'
import { resolveTurnDurationsMs } from '../model/defense-turn-durations'
import { DefenseReviewConfigTab } from './DefenseReviewConfigTab'
import { DefenseReviewNotesTab } from './DefenseReviewNotesTab'
import { StudentVerdict } from './StudentVerdict'
import { TurnAttemptsModal } from './TurnAttemptsModal'

/**
 * Props for the {@link DefenseReviewModalBody} component.
 */
type DefenseReviewModalBodyProps = {
  /** The conversation, as it arrived. */
  detail: DefenseReviewDetail
  /** How much of it stands on screen at once, and which part the reader is looking at. */
  panels: UseConversationPanelsResult<DefenseReviewPanelId>
  /** The first turn left to read since the reader's last pass; null while nothing marks one. */
  firstNewTurnId: string | null
  /** Picks the conversation up again from one of its turns. */
  onMarkUnreadFrom: (turnId: string) => void
  /** Which reply a new note will stand against; null for the conversation as a whole. */
  noteTurnId: string | null
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId: string | null
  /** Points a new note at another reply, or at the conversation as a whole. */
  onNoteTurnIdChange: (turnId: string | null) => void
}

/**
 * One conversation as it is read: the exchange itself, the solution it is judged against, what the examiner was
 * running on, and what has been written about it.
 */
export function DefenseReviewModalBody({
  detail,
  panels,
  firstNewTurnId,
  noteTurnId,
  landingNoteId,
  onMarkUnreadFrom,
  onNoteTurnIdChange,
}: DefenseReviewModalBodyProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Whose drafts are being read; null while none are
  const [draftsTurnId, setDraftsTurnId] = useState<string | null>(null)

  // Starting a note from the reply it is about
  const { composerRef, startNoteOn } = useNoteOnReply(panels.selectTab, onNoteTurnIdChange)

  // The drafts kept per reply, grouped once rather than filtered on every turn's render. Hand-folded rather
  // than through Map.groupBy, which no browser older than Safari 17.4 has and nothing here polyfills
  const attemptsByTurn = useMemo(
    () =>
      detail.attempts.reduce(
        (groups, attempt) =>
          groups.set(attempt.turnId, [...(groups.get(attempt.turnId) ?? []), attempt]),
        new Map<string, DefenseTurnAttempt[]>()
      ),
    [detail.attempts]
  )

  // How many each reply kept, which is what the transcript needs of them
  const draftCounts = useMemo(
    () => new Map([...attemptsByTurn].map(([turnId, attempts]) => [turnId, attempts.length])),
    [attemptsByTurn]
  )

  // How long each turn took its author
  const turnDurationsMs = useMemo(
    () => resolveTurnDurationsMs(detail.turns, attemptsByTurn),
    [detail.turns, attemptsByTurn]
  )

  // Where the reading stops, drawn only where it has read turns above it: over the whole conversation it
  // would separate nothing, and it would land where a rule between the statement and the transcript goes
  const newSince =
    firstNewTurnId === null || firstNewTurnId === detail.turns[0]?.id
      ? null
      : { turnId: firstNewTurnId, label: t('unreadDivider') }

  return (
    <>
      {/* The conversation and everything read or written against it, laid out by the room there is */}
      <ConversationPanes
        panels={panels}
        transcript={
          <TranscriptPane
            statement={detail.statement}
            turns={detail.turns}
            conversationKey={detail.id}
            reports={indexReports(detail.reports)}
            dividerBeforeTurn={newSince}
            // Where the next pass through it starts is the reviewer's to move, reply by reply
            unreadMark={{ label: t('markUnreadFromTurn'), onMark: onMarkUnreadFrom }}
            // A note about one of the examiner's replies can be started from the reply itself
            noteMark={{ label: t('notes.writeOnTurn'), onMark: startNoteOn }}
            // How each reply was arrived at, offered only on the replies that kept their drafts
            draftsMark={{
              label: (draftCount) => t('attempts.open', { draftCount }),
              draftCounts: draftCounts,
              onOpen: setDraftsTurnId,
            }}
            // And how long each turn took whoever wrote it, where that was measured
            turnDurationsMs={turnDurationsMs}
            // The reply a note is being written against is marked, but only while that is what the reader is
            // doing: a chip left selected under another panel points at nothing they can see
            pointedAtTurnId={panels.sideTabId === 'notes' ? noteTurnId : null}
            footer={
              <StudentVerdict
                feedback={detail.feedback}
                reports={detail.reports}
                turns={detail.turns}
              />
            }
          />
        }
        transcriptCount={null}
        reference={
          <ReferencePane
            statement={detail.statement}
            reference={detail.reference}
            isSplit={panels.isSplit}
            imageContext="handouts"
          />
        }
        ownPanels={{
          config: {
            label: t('tabs.config'),
            count: null,
            // Tied to the conversation, since the panel stays mounted across a step and a template left open
            // on screen would go on standing under its old title with the next conversation's text in it
            panel: <DefenseReviewConfigTab key={detail.id} config={detail.examinerConfig} />,
          },
          notes: {
            label: t('tabs.notes'),
            count: detail.notes.length === 0 ? null : detail.notes.length,
            panel: (
              <DefenseReviewNotesTab
                key={detail.id}
                sessionId={detail.id}
                notes={detail.notes}
                turns={detail.turns}
                turnId={noteTurnId}
                landingNoteId={landingNoteId}
                composerRef={composerRef}
                onTurnIdChange={onNoteTurnIdChange}
              />
            ),
          },
        }}
      />

      {/* Whichever reply's drafts are being read, over whatever layout is underneath */}
      <TurnAttemptsModal
        attempts={draftsTurnId === null ? null : (attemptsByTurn.get(draftsTurnId) ?? null)}
        onClose={() => setDraftsTurnId(null)}
      />
    </>
  )
}
