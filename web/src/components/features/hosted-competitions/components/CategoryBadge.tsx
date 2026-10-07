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

/** How large a badge is drawn. */
type CategoryBadgeSize = 'regular' | 'small'

/** The padding and text size of each badge size. */
const SIZE_CLASS: Record<CategoryBadgeSize, string> = {
  regular: 'px-2 py-0.5 text-sm',
  small: 'px-1.5 py-0.5 text-xs',
}

/**
 * Props for the {@link CategoryBadge} component.
 */
type CategoryBadgeProps = {
  /** The level being named. */
  category: HostedCompetitionCategory
  /** How large the badge is drawn. */
  size?: CategoryBadgeSize
}

/**
 * One level, named and coloured. Nothing about the reader tints it.
 */
export function CategoryBadge({ category, size = 'regular' }: CategoryBadgeProps) {
  // What the level is called
  const categoryName = useCategoryName()

  return (
    <span
      className={cn(
        'inline-flex rounded-md font-semibold',
        SIZE_CLASS[size],
        CATEGORY_BADGE_CLASS[category]
      )}
    >
      {categoryName(category)}
    </span>
  )
}
