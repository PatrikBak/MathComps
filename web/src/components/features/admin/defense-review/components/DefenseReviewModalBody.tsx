'use client'

import { useTranslations } from 'next-intl'

import { DefenseTranscript } from '@/components/features/defense/components/DefenseTranscript'
import { ProblemStrip } from '@/components/features/defense/components/ProblemStrip'
import { indexReports } from '@/components/features/defense/model/defense-conversation-model'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'

import type { UseDefenseReviewPanelsResult } from '../hooks/use-defense-review-panels'
import type { DefenseReviewTabId } from '../model/defense-review-tabs'
import type { DefenseReviewDetail } from '../model/defense-review-types'
import { DefenseReviewConfigTab } from './DefenseReviewConfigTab'
import { DefenseReviewNotesTab } from './DefenseReviewNotesTab'
import { StudentVerdict } from './StudentVerdict'

/**
 * Props for the {@link DefenseReviewModalBody} component.
 */
type DefenseReviewModalBodyProps = {
  /** The conversation, as it arrived. */
  detail: DefenseReviewDetail
  /** How much of it stands on screen at once, and which part the reader is looking at. */
  panels: UseDefenseReviewPanelsResult
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
 *
 * How many of those stand on screen at once is what the viewport decides, so the same panels are laid out two
 * ways: everything behind tabs where a split would leave neither half readable, and side by side where there is
 * room for it. Judging a reply against the reference, or writing a note about one, is the job this surface
 * exists for, and behind tabs that means holding the reply in your head while you look at the other half.
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

  // Defense-surface copy, for what the conversation's own parts are called
  const tDefense = useTranslations('defense')

  // Where the reading stops, drawn only where it has read turns above it: over the whole conversation it
  // would separate nothing, and it would land where a rule between the statement and the transcript goes
  const newSince =
    firstNewTurnId === null || firstNewTurnId === detail.turns[0]?.id
      ? null
      : { turnId: firstNewTurnId, label: t('unreadDivider') }

  // The conversation itself
  const transcriptPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The problem, re-readable above the conversation */}
      <ProblemStrip label={tDefense('problemStrip')} statement={detail.statement} />

      {/* What was said, and what the student made of it */}
      <DefenseTranscript
        turns={detail.turns}
        conversationKey={detail.id}
        roleLabels={{ examiner: tDefense('name'), candidate: t('student') }}
        regionLabel={tDefense('transcriptLabel')}
        jumpLabel={tDefense('jumpToLatest')}
        isThinking={false}
        thinkingLabel={tDefense('thinking')}
        reports={indexReports(detail.reports)}
        canAct={false}
        rewindLabel={tDefense('rewind')}
        reportLabel={tDefense('report')}
        reportedLabel={tDefense('reported')}
        onRewindTurn={() => undefined}
        onReportTurn={() => undefined}
        newSince={newSince}
        // Where the next pass through it starts is the reviewer's to move, reply by reply
        unreadMark={{ label: t('markUnreadFromTurn'), onMark: onMarkUnreadFrom }}
        // Notes hang off a reply by its place, so the reader needs the places to be there to read
        showPositions
        // And the one a note is being written against is marked, but only while that is what the
        // reader is doing: a chip left selected under another panel points at nothing they can see
        pointedAtTurnId={panels.sideTabId === 'notes' ? noteTurnId : null}
        footer={
          <StudentVerdict
            feedback={detail.feedback}
            reports={detail.reports}
            turns={detail.turns}
          />
        }
      />
    </div>
  )

  // The solution the conversation is judged against. It names itself and takes focus, since a pane that only
  // scrolls is otherwise out of reach from the keyboard and a long solution ends where the viewport does.
  const referencePane = (
    <div
      tabIndex={0}
      role="region"
      aria-label={t('tabs.reference')}
      className="math-typography flex-1 overflow-y-auto overscroll-contain px-5 py-4"
    >
      {/* The statement, only where the transcript's own strip isn't already showing it */}
      {!panels.isSplit && (
        <>
          {/* Section heading */}
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t('reference.statement')}</h3>

          {/* The statement itself */}
          <RichMathEditorRenderer
            content={detail.statement}
            lightImageBackground={false}
            imageContext="handouts"
          />
        </>
      )}

      {/* Section heading */}
      <h3 className={cn('mb-2 text-sm font-semibold text-foreground', !panels.isSplit && 'mt-5')}>
        {t('reference.solution')}
      </h3>

      {/* The solution itself */}
      <RichMathEditorRenderer
        content={detail.reference}
        lightImageBackground={false}
        imageContext="handouts"
      />
    </div>
  )

  // Everything read or written against the conversation. The reference drops out of the set once it has a
  // column of its own rather than being offered twice.
  const sidePanels = [
    ...(panels.hasReferenceColumn
      ? []
      : [
          {
            id: 'reference' as const,
            label: t('tabs.reference'),
            count: null,
            panel: referencePane,
          },
        ]),
    {
      id: 'config' as const,
      label: t('tabs.config'),
      count: null,
      // Tied to the conversation, since the panel stays mounted across a step and a template left open on
      // screen would go on standing under its old title with the next conversation's text in it
      panel: <DefenseReviewConfigTab key={detail.id} config={detail.examinerConfig} />,
    },
    {
      id: 'notes' as const,
      label: t('tabs.notes'),
      count: detail.notes.length,
      panel: (
        <DefenseReviewNotesTab
          key={detail.id}
          sessionId={detail.id}
          notes={detail.notes}
          turns={detail.turns}
          turnId={noteTurnId}
          landingNoteId={landingNoteId}
          onTurnIdChange={onNoteTurnIdChange}
        />
      ),
    },
  ]

  // Narrow: everything is a tab, since a split would leave neither half readable
  if (!panels.isSplit) {
    return (
      <Tabs<DefenseReviewTabId>
        ariaLabel={t('tabsLabel')}
        selectedId={panels.selectedTabId}
        onSelect={panels.selectTab}
        items={[
          {
            id: 'conversation',
            label: t('tabs.conversation'),
            count: null,
            panel: transcriptPane,
          },
          ...sidePanels,
        ]}
      />
    )
  }

  // Wide: the transcript and whatever is being read or written against it, side by side
  return (
    <div className="flex min-h-0 flex-1 flex-row">
      {/* The conversation */}
      {transcriptPane}

      {/* The solution in a column of its own, once there is room for one. The pane inside carries the name,
          so the column around it is layout and nothing else */}
      {panels.hasReferenceColumn && (
        <div className="flex min-h-0 w-[26rem] shrink-0 flex-col border-l border-foreground/10">
          {referencePane}
        </div>
      )}

      {/* Everything else read or written against it */}
      <div className="flex min-h-0 w-[28rem] shrink-0 flex-col border-l border-foreground/10">
        <Tabs<DefenseReviewTabId>
          ariaLabel={t('tabsLabel')}
          selectedId={panels.sideTabId}
          onSelect={panels.selectTab}
          items={sidePanels}
        />
      </div>
    </div>
  )
}
