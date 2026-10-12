import type {
  AuthorConversation,
  CountingWindow,
} from '@/components/features/conversation-review/model/conversation-detail'

import type { Grade, SelfAssessment } from '../../grades/model/grade-types'

/**
 * Where a student's graded entry stands on one problem.
 */
export type StudentGrading = CountingWindow & {
  /** The grade; null while nobody has given one. */
  grade: Grade | null
  /** What the student said about their own solution; null when they said nothing. */
  selfAssessment: SelfAssessment | null
}

/**
 * Every conversation one student held about one problem, and where their grade on it stands.
 */
export type StudentConversations = {
  /** The conversations, oldest first. */
  conversations: AuthorConversation[]
  /** Where the grade stands; null unless the student's entry on the problem is graded. */
  grading: StudentGrading | null
}
