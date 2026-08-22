'use client'

import { cn } from '@/components/shared/utils/css-utils'

import { useCategoryName } from '../hooks/use-category-name'
import type { HostedCompetitionCategory } from '../model/hosted-competition-types'

/**
 * The colour each level carries wherever it appears.
 *
 * A hue per level, kept clear of the ones already spoken for: violet for what is live, blue for a link.
 */
const CATEGORY_BADGE_CLASS: Record<HostedCompetitionCategory, string> = {
  elementary: 'bg-emerald-400/10 text-emerald-200',
  intermediate: 'bg-amber-400/10 text-amber-200',
  advanced: 'bg-rose-400/10 text-rose-200',
}

/**
 * Props for the {@link CategoryBadge} component.
 */
type CategoryBadgeProps = {
  /** The level being named. */
  category: HostedCompetitionCategory
}

/**
 * One level, named and coloured. Nothing about the reader tints it.
 */
export function CategoryBadge({ category }: CategoryBadgeProps) {
  // What the level is called
  const categoryName = useCategoryName()

  return (
    <span
      className={cn(
        'inline-flex rounded-md px-2 py-0.5 text-sm font-semibold',
        CATEGORY_BADGE_CLASS[category]
      )}
    >
      {categoryName(category)}
    </span>
  )
}
