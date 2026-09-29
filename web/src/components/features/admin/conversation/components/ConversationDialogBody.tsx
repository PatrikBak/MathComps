'use client'

import { useFormatter, useTranslations } from 'next-intl'

import type { NamedDefenseTarget } from '@/components/features/defense/model/defense-types'
import { Button } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { ImageContext } from '@/components/shared/utils/media-utils'

import { GradePanel } from '../../grades/components/GradePanel'
import type { UseUpdateGradeResult } from '../../grades/hooks/use-update-grade'
import { pairKey } from '../../grades/model/grade-types'
import { NotesPanel } from '../../notes/components/NotesPanel'
import type { SidePanelId, UseConversationPanelsResult } from '../hooks/use-conversation-panels'
import { useNoteOnReply } from '../hooks/use-note-on-reply'
import type { AdminConversation, StudentConversations } from '../model/admin-conversation'
import { ConversationPanes } from './ConversationPanes'
import { ExaminerConfigPanel } from './ExaminerConfigPanel'
import { ReferencePane } from './ReferencePane'
import { TranscriptPane } from './TranscriptPane'

/**
 * Where the images of a conversation's statement and reference are kept, by what it was held against.
 */
const IMAGE_CONTEXTS = {
  handout: 'handouts',
  problem: 'problems',
} as const satisfies Record<NamedDefenseTarget['kind'], ImageContext>

/**
 * Which side panels a note is written in.
 */
const WRITES_NOTES = {
  grade: false,
  reference: false,
  notes: true,
  config: false,
} as const satisfies Record<SidePanelId, boolean>

/**
 * Reads the archive problem a conversation is graded on, if it is held against one.
 *
 * @param target - What the conversation was held against.
 * @returns The problem's id; null for a handout environment, which nobody is graded on.
 */
function gradedProblemIdOf(target: NamedDefenseTarget): string | null {
  switch (target.kind) {
    // An archive problem, which is what a grade is given on
    case 'problem':
      return target.problemId

    // A handout environment, which nobody is graded on
    case 'handout':
      return null

    // A target nothing here knows
    default:
      return assertNever(target)
  }
}

/**
 * Props for the {@link ConversationDialogBody} component.
 */
type ConversationDialogBodyProps = {
  /** The conversation on screen, as it arrived. */
  detail: AdminConversation
  /** Every conversation the student held about the problem, and their grading. */
  studentConversations: StudentConversations
  /** How much stands on screen at once, and which part the reader is looking at. */
  panels: UseConversationPanelsResult
  /** The first turn left to read since the reader's last pass; null while nothing marks one. */
  firstNewTurnId: string | null
  /** Picks the conversation up again from one of its turns. */
  onMarkUnreadFrom: (turnId: string) => void
  /** Which reply a new note will stand against; null for the conversation as a whole. */
  noteTurnId: string | null
  /** Points a new note at another reply, or at the conversation as a whole. */
  onNoteTurnIdChange: (turnId: string | null) => void
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId: string | null
  /** Shows another of the student's conversations about the problem. */
  onSelectConversation: (conversationId: string) => void
  /** {@link UseUpdateGradeResult.changeGrade}. */
  onChangeGrade: UseUpdateGradeResult['changeGrade']
}

/**
 * One conversation as it is read: the exchange itself with the student's other conversations about the problem a
 * switch away, the grade where there is one to give, the solution it is judged against, what has been written
 * about it, and what the examiner was running on.
 *
 * Where the student is graded, a conversation started outside their entry's window is marked as not counting
 * toward the grade.
 */
export function ConversationDialogBody({
  detail,
  studentConversations,
  panels,
  firstNewTurnId,
  onMarkUnreadFrom,
  noteTurnId,
  onNoteTurnIdChange,
  landingNoteId,
  onSelectConversation,
  onChangeGrade,
}: ConversationDialogBodyProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  // Dates in the reader's language
  const format = useFormatter()

  // Starting a note from the reply it is about
  const { composerRef, startNoteOn } = useNoteOnReply(panels.selectTab, onNoteTurnIdChange)

  // The student's conversations about the problem, and where their grade on it stands
  const { conversations, grading } = studentConversations

  // What the conversation was held against
  const { target } = detail

  // The problem a grade is given on, which only an archive problem is
  const gradedProblemId = gradedProblemIdOf(target)

  // A function which says whether a conversation counts toward the grade, which every one does where the student
  // isn't graded
  const counts = (conversationId: string) =>
    grading === null || grading.countingConversationIds.includes(conversationId)

  // Whether the switch between the student's conversations says anything: there is another to switch to, or one
  // of them doesn't count
  const showsSwitch =
    conversations.length > 1 || conversations.some((conversation) => !counts(conversation.id))

  return (
    // The conversation and everything read or written against it, laid out by the room there is
    <ConversationPanes
      panels={panels}
      transcript={
        <TranscriptPane
          conversation={detail}
          aboveStatement={
            showsSwitch && (
              // The switch between the conversations, each by its number and when it started
              <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-foreground/10 px-4 py-2">
                {conversations.map((conversation, index) => (
                  <Button
                    key={conversation.id}
                    size="sm"
                    variant={conversation.id === detail.id ? 'subtle' : 'ghost'}
                    aria-pressed={conversation.id === detail.id}
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    {/* The conversation's number */}
                    {t('conversationNumber', { number: index + 1 })}

                    {/* When the conversation started */}
                    <span className="text-xs text-muted">
                      {format.dateTime(new Date(conversation.createdAt), {
                        day: 'numeric',
                        month: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {/* Outside the window the grade is read from */}
                    {!counts(conversation.id) && (
                      <span className="text-xs font-medium text-warning">{t('notCounting')}</span>
                    )}
                  </Button>
                ))}
              </div>
            )
          }
          firstNewTurnId={firstNewTurnId}
          onMarkUnreadFrom={onMarkUnreadFrom}
          onStartNote={startNoteOn}
          // The reply a note is being written against is marked, but only while that is what the reader is
          // doing: a chip left selected under another panel points at nothing they can see
          pointedAtTurnId={WRITES_NOTES[panels.sideTabId] ? noteTurnId : null}
        />
      }
      transcriptCount={conversations.length > 1 ? conversations.length : null}
      sidePanels={{
        grade: {
          count: null,
          // Only a graded student on an archive problem has a grade. Tied to the student and problem, so moving to
          // another saves the comment on the way out.
          panel: grading !== null && gradedProblemId !== null && (
            <GradePanel
              key={pairKey(detail.user.id, gradedProblemId)}
              grade={grading.grade}
              selfAssessment={grading.selfAssessment}
              onChange={(change) => onChangeGrade(detail.user.id, gradedProblemId, change)}
            />
          ),
        },
        reference: {
          count: null,
          panel: (
            <ReferencePane
              statement={detail.statement}
              reference={detail.reference}
              isSplit={panels.isSplit}
              imageContext={IMAGE_CONTEXTS[target.kind]}
            />
          ),
        },
        notes: {
          count: detail.notes.length === 0 ? null : detail.notes.length,
          panel: (
            <NotesPanel
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
        config: {
          count: null,
          // Tied to the conversation, since the panel can stay mounted from one conversation to the next, and a
          // template left open would go on standing over the next one
          panel: <ExaminerConfigPanel key={detail.id} config={detail.examinerConfig} />,
        },
      }}
    />
  )
}
