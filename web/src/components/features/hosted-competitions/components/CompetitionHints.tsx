'use client'

import { Lightbulb } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { CompetitionProblemSurface } from './CompetitionProblemSurface'
import { HintLadder } from './HintLadder'

/**
 * Props for the {@link CompetitionHints} component.
 */
type CompetitionHintsProps = {
  /** The number the problem goes by. */
  position: number
  /** The statement as markdown/math source. */
  statement: string
  /** The author's hints, weakest nudge first. */
  hints: string[]
  /** Whether this problem is the one whose hints are being read. */
  isOpen: boolean
  /** Opens the hints. */
  onOpen: () => void
  /** Closes the hints. */
  onClose: () => void
}

/**
 * The author's hints towards one problem: a line on the problem, and the ladder itself on a surface of its own.
 */
export function CompetitionHints({
  position,
  statement,
  hints,
  isOpen,
  onOpen,
  onClose,
}: CompetitionHintsProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  return (
    <CompetitionProblemSurface
      label={t('hints')}
      icon={Lightbulb}
      position={position}
      statement={statement}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      count={null}
      isTall={false}
    >
      <HintLadder hints={hints} />
    </CompetitionProblemSurface>
  )
}
