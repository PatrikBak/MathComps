'use client'

import { memo } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { PROBLEM_CARD_LAYOUTS } from '../constants/problem-card-layouts'
import { ProblemCard, type ProblemCardProps } from './ProblemCard'

/**
 * A problem's card as one row of the list, spaced from the row below it.
 */
export const ProblemListItem = memo(function ProblemListItem(cardProps: ProblemCardProps) {
  return (
    <div className={cn(PROBLEM_CARD_LAYOUTS[cardProps.view].spacingBelowClass, 'pr-2')}>
      <ProblemCard {...cardProps} />
    </div>
  )
})
