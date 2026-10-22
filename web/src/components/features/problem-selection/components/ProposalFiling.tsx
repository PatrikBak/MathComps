'use client'

import { Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import Chip from '@/components/features/problems/components/Chip'
import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { cn } from '@/components/shared/utils/css-utils'
import { localeCodeList } from '@/i18n/i18n'

import { useAreaName } from '../hooks/use-area-name'
import { placementsOf, unreadyLanguages, unwrittenAcross } from '../model/selection-state'
import {
  type Proposal,
  type ProposalArea,
  type ProposalRating,
  RATING_ASPECTS,
} from '../model/selection-types'
import { PlacementMark, RecommendedMarks, WARNING_MARK_CLASS } from './CategoryMarks'
import { RatingBreakdown } from './RatingBreakdown'
import { useLoadedSelection } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link ProposalFiling} component.
 */
type ProposalFilingProps = {
  /** The problem. */
  proposal: Proposal
}

/**
 * The marks saying what a problem is filed under, where it sits, whether it is on offer, what it still lacks, and how
 * many reviewers rated it. Languages count as lacking only where the problems need every language.
 */
export function ProposalFiling({ proposal }: ProposalFilingProps) {
  // Filing-line copy
  const t = useTranslations('problemSelection.filing')

  // Every board, and whether the problems need every language
  const { boards, needsEveryLanguage } = useLoadedSelection()

  // Every slot the problem fills, across every board
  const placements = placementsOf(boards, proposal.id)

  // The languages nothing of the problem can be read in, none where any one text will do
  const unwritten = needsEveryLanguage ? unwrittenAcross([proposal]) : []

  // The languages the problem can be read in but has no solution in, none where any one text will do
  const unsolved = needsEveryLanguage
    ? unreadyLanguages(proposal).filter((language) => !unwritten.includes(language))
    : []

  return (
    <>
      {/* The categories the problem is recommended for */}
      <RecommendedMarks recommended={proposal.recommended} />

      {/* The problem's area */}
      <AreaChip area={proposal.area} />

      {/* Every slot the problem fills */}
      {placements.map((placement) => (
        <PlacementMark
          key={`${placement.board.id}-${placement.paper.id}-${placement.index}`}
          placement={placement}
        />
      ))}

      {/* A note for a problem the reviewers set aside */}
      {proposal.isSetAside && <FilingWarning>{t('setAside')}</FilingWarning>}

      {/* A note for a problem a round has taken */}
      {proposal.isUsed && <FilingWarning>{t('used')}</FilingWarning>}

      {/* Languages with no text at all */}
      {unwritten.length > 0 && (
        <FilingWarning>{t('unwritten', { languages: localeCodeList(unwritten) })}</FilingWarning>
      )}

      {/* Languages with a statement but no solution */}
      {unsolved.length > 0 && (
        <FilingWarning>{t('noSolution', { languages: localeCodeList(unsolved) })}</FilingWarning>
      )}

      {/* How many reviewers rated the problem */}
      <RatingsMark ratings={proposal.ratings} />
    </>
  )
}

/**
 * Props for the {@link AreaChip} component.
 */
type AreaChipProps = {
  /** The problem's area. */
  area: ProposalArea
}

/**
 * A problem's area, as a chip.
 */
export function AreaChip({ area }: AreaChipProps) {
  // What each area is called
  const areaName = useAreaName()

  // The area's name, as a chip
  return <Chip className="border-transparent py-px leading-4 sm:py-px">{areaName(area)}</Chip>
}

/**
 * Props for the {@link RatingsMark} component.
 */
type RatingsMarkProps = {
  /** The problem's ratings. */
  ratings: readonly ProposalRating[]
}

/**
 * How many reviewers rated a problem, showing who gave what while hovered, focused or pressed. Absent while nobody has.
 */
export function RatingsMark({ ratings }: RatingsMarkProps) {
  // Rating copy
  const t = useTranslations('problemSelection.ratings')

  // Nobody to count, nothing to show
  if (ratings.length === 0) return null

  // The count, opening every reviewer's scores
  return (
    <Tooltip
      placement="top"
      content={<RatingBreakdown ratings={ratings} aspects={RATING_ASPECTS} />}
    >
      <button
        type="button"
        aria-label={t('ratedBy', { count: ratings.length })}
        className={cn(
          'inline-flex items-center gap-1 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-xs tabular-nums',
          'text-muted transition-colors hover:text-foreground',
          FOCUS_RING_CLASS
        )}
      >
        <Star size={12} aria-hidden />
        {ratings.length}
      </button>
    </Tooltip>
  )
}

/**
 * Props for the {@link FilingWarning} component.
 */
type FilingWarningProps = {
  /** The warning, in a few words. */
  children: ReactNode
}

/**
 * A warning about a problem, as a note on its filing line.
 */
function FilingWarning({ children }: FilingWarningProps) {
  // The warning, as a mark in the warning colour
  return <span className={cn(WARNING_MARK_CLASS, 'px-1.5 py-0.5 text-xs')}>{children}</span>
}
