'use client'

import { useTranslations } from 'next-intl'

import { ProblemSurfaceModal } from '@/components/domain/problem/ProblemSurfaceModal'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { assertNever } from '@/components/shared/utils/assert-never'

import { useProblemBySlug } from '../hooks/use-problem-by-slug'
import { useSolutionReadNotices } from '../hooks/use-solution-read-notices'

/**
 * Props for the {@link ProblemSolutionDialog} component.
 */
type ProblemSolutionDialogProps = {
  /** The slug of the problem whose solution is open. */
  problemSlug: string
  /** Closes the solution. */
  onClose: () => void
}

/**
 * The solution to one problem of the archive, in a dialog: the statement on top and the solution under it. A problem
 * with no solution text has no dialog. A read that finds no problem, or fails, is said in {@link useSolutionReadNotices}.
 */
export function ProblemSolutionDialog({ problemSlug, onClose }: ProblemSolutionDialogProps) {
  // What became of reading the problem by its slug
  const read = useProblemBySlug(problemSlug)

  // The notices that read raises
  useSolutionReadNotices({ read, problemSlug, onClose })

  // Problems library translations
  const tProblems = useTranslations('problems')

  // What the problem's read came to
  switch (read.kind) {
    // A problem still on its way, one that is not there, or one whose read failed has no dialog
    case 'unread':
    case 'missing':
    case 'failed':
      return null

    // A problem that is there, whose solution shows when it has one
    case 'found': {
      // The problem
      const { problem } = read

      // One with no solution to read has no dialog
      if (problem.solutionMarkdown === null) return null

      return (
        <ProblemSurfaceModal
          label={tProblems('solution')}
          heading={problem.slug.toUpperCase()}
          statement={problem.statementMarkdown}
          onClose={onClose}
          size="text"
        >
          <div className="math-typography math-reference">
            <RichMathEditorRenderer content={problem.solutionMarkdown} imageContext="problems" />
          </div>
        </ProblemSurfaceModal>
      )
    }

    // Every read state is handled above
    default:
      return assertNever(read)
  }
}
