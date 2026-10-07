'use client'

import { CategoryBadge } from '@/components/features/hosted-competitions/components/CategoryBadge'
import type { HostedCompetitionCategory } from '@/components/features/hosted-competitions/model/hosted-competition-types'

/**
 * The look of a mark warning about a problem, in the theme's warning colour, which no category wears.
 */
export const WARNING_MARK_CLASS = 'rounded-md bg-warning/10 text-warning'

/**
 * Props for the {@link RecommendedMarks} component.
 */
type RecommendedMarksProps = {
  /** The categories a proposal is recommended for. */
  categories: readonly HostedCompetitionCategory[]
}

/**
 * The categories a proposal is recommended for, each in its own colour.
 */
export function RecommendedMarks({ categories }: RecommendedMarksProps) {
  // A badge per category
  return categories.map((category) => (
    <CategoryBadge key={category} category={category} size="small" />
  ))
}
