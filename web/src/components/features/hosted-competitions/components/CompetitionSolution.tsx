'use client'

import { BookOpen } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { ProblemMarkdown } from '@/components/shared/components/rich-math-editor/components/ProblemMarkdown'
import type { Locale, LocalizedString } from '@/i18n/i18n'

import { CompetitionProblemSurface } from './CompetitionProblemSurface'

/**
 * Props for the {@link CompetitionSolution} component.
 */
type CompetitionSolutionProps = {
  /** Which of the set it solves, counting from one. */
  position: number
  /** The statement as markdown/math source, in every language the site is read in. */
  statement: LocalizedString
  /** The official solution, in every language the site is read in. */
  solution: LocalizedString
  /** Whether this problem is the one whose solution is being read. */
  isOpen: boolean
  /** Opens the solution. */
  onOpen: () => void
  /** Closes the solution. */
  onClose: () => void
}

/**
 * The official solution to one of a competition's problems: a line on the problem, and the solution itself
 * on a surface of its own.
 *
 * Only ever drawn once the student is no longer competing here, which is when a solution reaches the page
 * at all.
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

  // The active locale, which decides which language the solution is read in
  const locale = useLocale() as Locale

  return (
    <CompetitionProblemSurface
      label={t('officialSolution')}
      icon={BookOpen}
      position={position}
      statement={statement}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
    >
      <div className="math-typography math-reference">
        <ProblemMarkdown content={solution[locale]} />
      </div>
    </CompetitionProblemSurface>
  )
}
