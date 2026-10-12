'use client'

import {
  ConversationDialog,
  type ConversationDialogProps,
} from '@/components/features/conversation-review/components/ConversationDialog'
import type { ConversationGrading } from '@/components/features/conversation-review/components/ConversationDialogBody'
import { assertNever } from '@/components/shared/utils/assert-never'

import { GradeConversation } from '../../grades/components/GradeConversation'
import { GradePanel } from '../../grades/components/GradePanel'
import { useUpdateGrade } from '../../grades/hooks/use-update-grade'
import { type PairIds, pairKey } from '../../grades/model/grade-types'
import { useReviewQueueAndNoteFeedSync } from '../hooks/use-review-queue-and-note-feed-sync'
import { type StudentProblem, useStudentConversations } from '../hooks/use-student-conversations'

/**
 * Reads the student and the archive problem a grade on their conversations would be given on.
 *
 * @param studentProblem - The student and problem; null while they are not known.
 *
 * @returns The pair; null while nobody is known, and for a handout environment, which nobody is graded on.
 */
function gradedPairOf(studentProblem: StudentProblem | null): PairIds | null {
  // Nobody to grade while nobody is known
  if (studentProblem === null) return null

  // The student, and what their conversations are held against
  const { user, target } = studentProblem

  // Graded by what the conversations are held against
  switch (target.kind) {
    // An archive problem, which is what a grade is given on
    case 'problem':
      return { userId: user.id, problemId: target.problemId }

    // A handout environment, which nobody is graded on
    case 'handout':
      return null

    // A target nothing here knows
    default:
      return assertNever(target)
  }
}

/**
 * Props for the {@link AdminConversationDialog} component.
 */
type AdminConversationDialogProps = Omit<
  ConversationDialogProps,
  'author' | 'conversationList' | 'grading' | 'listSync'
> & {
  /** The student and problem the open item is about; null while that is unknown. */
  studentProblem: StudentProblem | null
}

/**
 * The conversation dialog as an admin works through it: every conversation the student held about the problem,
 * the grade on it where the student is graded, and the review queue and the notes feed kept in step with whatever
 * is marked or written.
 *
 * Grades are changed from here rather than from the panel showing the grade, since the panel comes and goes with
 * the conversation on screen while a change made in it may still be settling.
 */
export function AdminConversationDialog({
  studentProblem,
  ...dialogProps
}: AdminConversationDialogProps) {
  // Every conversation the student held about the problem, and where their grade on it stands
  const { conversationList, grading } = useStudentConversations(studentProblem)

  // The student and the archive problem a grade is given on; null where there is none
  const pair = gradedPairOf(studentProblem)

  // Changing grades
  const { changeGrade } = useUpdateGrade()

  // The grade with the parts it is given and talked over in, where the student is graded on an archive problem
  const conversationGrading: ConversationGrading | null =
    grading === null || pair === null
      ? null
      : {
          window: grading,
          // Tied to the student and problem, so moving to another saves the grade's comment on the way out
          gradePanel: (
            <GradePanel
              key={pairKey(pair.userId, pair.problemId)}
              grade={grading.grade}
              selfAssessment={grading.selfAssessment}
              onChange={(change) => changeGrade(pair.userId, pair.problemId, change)}
            />
          ),
          // Tied to the student and problem, so moving to another starts a fresh reply to the student
          feedbackPanel: (
            <GradeConversation
              key={pairKey(pair.userId, pair.problemId)}
              problemId={pair.problemId}
              userId={pair.userId}
            />
          ),
        }

  // The review queue and the notes feed
  const listSync = useReviewQueueAndNoteFeedSync()

  return (
    <ConversationDialog
      {...dialogProps}
      author={studentProblem?.user ?? null}
      conversationList={conversationList}
      grading={conversationGrading}
      listSync={listSync}
    />
  )
}
