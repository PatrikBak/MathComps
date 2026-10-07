'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import Chip from '@/components/features/problems/components/Chip'
import { cn } from '@/components/shared/utils/css-utils'
import { localeCodeList } from '@/i18n/i18n'

import { useAreaName } from '../hooks/use-area-name'
import { unreadyLanguages, unwrittenLanguages } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { RecommendedMarks, WARNING_MARK_CLASS } from './CategoryMarks'

/**
 * Props for the {@link ProposalFiling} component.
 */
type ProposalFilingProps = {
  /** The problem. */
  proposal: Proposal
}

/**
 * One line saying what a problem is filed under, whether it is on offer, and what it still lacks.
 */
export function ProposalFiling({ proposal }: ProposalFilingProps) {
  // Filing-line copy
  const t = useTranslations('problemSelection.filing')

  // What each area is called
  const areaName = useAreaName()

  // The languages nothing of the problem can be read in
  const unwritten = unwrittenLanguages(proposal)

  // The languages the problem can be read in but has no solution in
  const unsolved = unreadyLanguages(proposal).filter((language) => !unwritten.includes(language))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* The categories the problem is recommended for */}
      <RecommendedMarks categories={proposal.recommended} />

      {/* The problem's area */}
      <Chip className="border-transparent py-px leading-4 sm:py-px">{areaName(proposal.area)}</Chip>

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
    </div>
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
