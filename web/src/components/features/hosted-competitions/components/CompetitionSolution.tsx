'use client'

import { BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

import { CompetitionProblemSurface } from './CompetitionProblemSurface'

/**
 * Props for the {@link CompetitionSolution} component.
 */
type CompetitionSolutionProps = {
  /** The number the problem goes by. */
  position: number
  /** The statement as markdown/math source. */
  statement: string
  /** The official solution. */
  solution: string
  /** Whether this problem is the one whose solution is being read. */
  isOpen: boolean
  /** Opens the solution. */
  onOpen: () => void
  /** Closes the solution. */
  onClose: () => void
}

/**
 * The official solution to one problem: a line on the problem, and the solution itself on a surface of its own.
 */
export function CompetitionSolution({
  position,
  statement,
  solution,
  isOpen,
  onOpen,
  onClose,
}: CompetitionSolutionProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  return (
    <CompetitionProblemSurface
      label={t('officialSolution')}
      icon={BookOpen}
      position={position}
      statement={statement}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      count={null}
      isTall={false}
    >
      <div className="math-typography math-reference">
        <RichMathEditorRenderer content={solution} imageContext="problems" />
      </div>
    </CompetitionProblemSurface>
  )
}
