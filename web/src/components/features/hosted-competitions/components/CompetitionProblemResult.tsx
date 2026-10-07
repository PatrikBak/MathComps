'use client'

import { useQueryClient } from '@tanstack/react-query'
import { MessagesSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { formatScore, MAX_MARK } from '@/components/features/admin/grades/model/grade-types'
import { CommentSection } from '@/components/features/comments/components/CommentSection'
import { assertNever } from '@/components/shared/utils/assert-never'

import { invalidateCompetitionProblems } from '../hooks/hosted-competition-cache'
import type { GradeConversation, ProblemResult } from '../model/hosted-competition-types'
import { CompetitionProblemSurface } from './CompetitionProblemSurface'

/**
 * Props for the {@link ProblemScore}.
 */
type ProblemScoreProps = {
  /** The reader's result on the problem. */
  result: ProblemResult
}

/**
 * The reader's score on one problem, as the head of its panel says it: the score out of the full mark, and
 * where Mathilda helped, how the mark split. Nothing for a problem they never wrote about.
 */
export function ProblemScore({ result }: ProblemScoreProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // What the head says, by where marking the problem stands
  switch (result.kind) {
    // Never written about, which the panel's missing conversation already says
    case 'none':
      return null

    // Still being marked
    case 'pending':
      return <span className="text-sm text-muted">{t('notMarked')}</span>

    // Marked for good
    case 'final':
      return (
        <span className="flex flex-col items-end text-right leading-tight">
          <span className="text-sm text-muted">
            {t.rich('problemScore', {
              score: formatScore(result.mark - result.help / 2),
              max: MAX_MARK,
              value: (chunks) => (
                <span className="font-semibold tabular-nums text-foreground">{chunks}</span>
              ),
            })}
          </span>
          {result.help > 0 && (
            <span className="text-xs text-muted">
              {t('helped', { mark: result.mark, help: result.help })}
            </span>
          )}
        </span>
      )

    // Every result is handled above
    default:
      return assertNever(result)
  }
}

/**
 * Props for the {@link GradeComments}.
 */
type GradeCommentsProps = {
  /** Which of the set this is, counting from one. */
  position: number
  /** The statement as markdown/math source, in the language being read. */
  statement: string
  /** The conversation with the graders about the mark. */
  conversation: GradeConversation
  /** Whether this problem is the one whose thread is being read. */
  isOpen: boolean
  /** Opens the thread. */
  onOpen: () => void
  /** Closes the thread. */
  onClose: () => void
}

/**
 * The conversation with the graders about one mark: a row among the problem's others, opening onto the
 * thread.
 */
export function GradeComments({
  position,
  statement,
  conversation,
  isOpen,
  onOpen,
  onClose,
}: GradeCommentsProps) {
  // Results copy
  const t = useTranslations('competitions.resultsView')

  // The React Query cache
  const queryClient = useQueryClient()

  // A function which closes the thread, then reads the problem again so the row counts what was written
  const closeThread = () => {
    // The thread, off the screen
    onClose()

    // The problem read again, its message count with it
    invalidateCompetitionProblems(queryClient)
  }

  return (
    <CompetitionProblemSurface
      label={t('comments')}
      icon={MessagesSquare}
      position={position}
      statement={statement}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={closeThread}
      count={conversation.messageCount}
      isTall
    >
      <CommentSection
        variant="inline"
        showLikes={false}
        showEmptyText={false}
        newCommentPlaceholder={t('commentsPlaceholder')}
        target={{ targetType: 'HostedGrade', targetId: conversation.targetId }}
      />
    </CompetitionProblemSurface>
  )
}
