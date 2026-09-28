'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

import { ConversationModal } from '@/components/features/admin/components/ConversationModal'
import { ConversationPanes } from '@/components/features/admin/components/ConversationPanes'
import { ReferencePane } from '@/components/features/admin/components/ReferencePane'
import { TranscriptPane } from '@/components/features/admin/components/TranscriptPane'
import {
  type SidePanelId,
  useConversationPanels,
  type UseConversationPanelsResult,
} from '@/components/features/admin/hooks/use-conversation-panels'
import { describeUser } from '@/components/features/admin/model/user-identity'
import type { DefenseTurnReport } from '@/components/features/defense/model/defense-types'
import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { Button } from '@/components/shared/components/Button'
import type { UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'

import { useGradeDetail } from '../hooks/use-grade-detail'
import { useUpdateGrade } from '../hooks/use-update-grade'
import type {
  Grade,
  GradeChange,
  GradeDetail,
  GradeSummary,
  GradingCompetition,
  GradingPair,
} from '../model/grading-types'
import { GradePanel } from './GradePanel'

/** The grading dialog's side panels, in the order their tabs read. */
const GRADING_SIDE_PANELS: readonly SidePanelId<'grade'>[] = ['grade', 'reference']

/** Nothing reported, since graders are shown none of the student's reports. */
const NO_REPORTS = new Map<string, DefenseTurnReport>()

/**
 * Props for the {@link GradingModal} component.
 */
type GradingModalProps = {
  /** What addresses the group being graded. */
  groupSlug: string
  /** The competition being graded. */
  competition: GradingCompetition
  /** The competition's entrants on its problems, by pair. */
  pairs: ReadonlyMap<string, GradingPair>
  /** The competition's grades, by pair. */
  grades: ReadonlyMap<string, GradeSummary>
  /** Which pair is open, and the walk through every pair with a conversation. */
  selection: UseSteppedSelectionResult
}

/**
 * One student on one problem: their conversations, the reference, and the grade. Each pair opens on its
 * conversation.
 */
export function GradingModal({
  groupSlug,
  competition,
  pairs,
  grades,
  selection,
}: GradingModalProps) {
  // Grading copy
  const t = useTranslations('admin.grading')

  // Profile copy
  const tProfile = useTranslations('profile')

  // What each level is called
  const categoryName = useCategoryName()

  // The open pair; null while none is
  const pair = selection.openId === null ? null : (pairs.get(selection.openId) ?? null)

  // Everything the open pair's grade is read from
  const { detail, uiState } = useGradeDetail(pair)

  // Which parts stand on screen at once, back on the conversation for every pair
  const panels = useConversationPanels(GRADING_SIDE_PANELS, selection.openId)

  // Changing grades on this group's board
  const { changeGrade } = useUpdateGrade(groupSlug)

  // The student's name, once a pair is open
  const student = pair === null ? null : describeUser(pair.user, tProfile('defaultUser'))

  // The open pair's grade, as the board holds it
  const grade = selection.openId === null ? null : (grades.get(selection.openId)?.grade ?? null)

  return (
    <ConversationModal
      selection={selection}
      ariaLabel={student === null ? t('title') : t('dialogTitle', { student })}
      title={student}
      subtitle={
        pair === null
          ? null
          : t('pairSubtitle', {
              category: categoryName(competition.category),
              number: pair.problem.number,
            })
      }
      body={
        // The open pair, once its conversations have arrived and there is one to read
        pair === null || detail === null || detail.conversations.length === 0 ? null : (
          <GradingModalBody
            // A new pair starts on its first conversation, and saves the last one's comment on the way out
            key={selection.openId}
            detail={detail}
            panels={panels}
            grade={grade}
            onChange={(change) => changeGrade(pair.user.id, pair.problem.id, change)}
          />
        )
      }
      uiState={uiState}
      failedMessage={t('detailFailed')}
    />
  )
}

/**
 * Props for the {@link GradingModalBody} component.
 */
type GradingModalBodyProps = {
  /** Everything the grade is read from. */
  detail: GradeDetail
  /** How much stands on screen at once, and which part the reader is looking at. */
  panels: UseConversationPanelsResult<'grade'>
  /** The grade; null while none is given. */
  grade: Grade | null
  /** Records a change to the grade, resolving to whether the server took it. */
  onChange: (change: GradeChange) => Promise<boolean>
}

/**
 * The conversations, the reference, and the grade, side by side where the screen allows. Several conversations
 * on one problem are switched between above the transcript.
 */
function GradingModalBody({ detail, panels, grade, onChange }: GradingModalBodyProps) {
  // Grading copy
  const t = useTranslations('admin.grading')

  // Dates in the reader's language
  const format = useFormatter()

  // Which conversation is showing, by position
  const [conversationIndex, setConversationIndex] = useState(0)

  // The conversation showing, the first where the position has run past the list
  const conversation = detail.conversations[conversationIndex] ?? detail.conversations[0]

  // Whether there is more than one conversation to switch between
  const hasSeveral = detail.conversations.length > 1

  return (
    <ConversationPanes
      panels={panels}
      transcript={
        <TranscriptPane
          statement={conversation.statement}
          aboveStatement={
            hasSeveral && (
              // The switch between the conversations, each by its number and when it started
              <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-foreground/10 px-4 py-2">
                {detail.conversations.map((candidate, candidateIndex) => (
                  <Button
                    key={candidate.id}
                    size="sm"
                    variant={candidateIndex === conversationIndex ? 'subtle' : 'ghost'}
                    aria-pressed={candidateIndex === conversationIndex}
                    onClick={() => setConversationIndex(candidateIndex)}
                  >
                    {t('conversationNumber', { number: candidateIndex + 1 })}
                    <span className="text-xs text-muted">
                      {format.dateTime(new Date(candidate.createdAt), {
                        day: 'numeric',
                        month: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </Button>
                ))}
              </div>
            )
          }
          turns={conversation.turns}
          conversationKey={conversation.id}
          reports={NO_REPORTS}
          dividerBeforeTurn={null}
          unreadMark={null}
          noteMark={null}
          draftsMark={null}
          turnDurationsMs={null}
          footer={null}
        />
      }
      transcriptCount={hasSeveral ? detail.conversations.length : null}
      reference={
        <ReferencePane
          statement={conversation.statement}
          reference={conversation.reference}
          isSplit={panels.isSplit}
          imageContext="problems"
        />
      }
      ownPanels={{
        grade: {
          label: t('tabs.grade'),
          count: null,
          panel: (
            <GradePanel grade={grade} selfAssessment={detail.selfAssessment} onChange={onChange} />
          ),
        },
      }}
    />
  )
}
