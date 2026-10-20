'use client'

import { HueBadge } from '@/components/shared/components/HueBadge'

import { useCategoryName } from '../hooks/use-category-name'
import {
  HOSTED_COMPETITION_CATEGORIES,
  type HostedCompetitionCategory,
} from '../model/hosted-competition-types'

/**
 * Props for the {@link CategoryBadge} component.
 */
type CategoryBadgeProps = {
  /** The level being named. */
  category: HostedCompetitionCategory
}

/**
 * One level, named and coloured by its place among the levels.
 */
export function CategoryBadge({ category }: CategoryBadgeProps) {
  // What the level is called
  const categoryName = useCategoryName()

  return (
    <HueBadge
      label={categoryName(category)}
      hue={HOSTED_COMPETITION_CATEGORIES.indexOf(category)}
    />
  )
}
