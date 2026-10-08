'use client'

import { cn } from '@/components/shared/utils/css-utils'

import { useCategoryName } from '../hooks/use-category-name'
import type { HostedCompetitionCategory } from '../model/hosted-competition-types'

/**
 * The ink each level carries wherever it appears, on its tint or on none.
 *
 * A hue per level, kept clear of the ones already spoken for: violet for what is live, blue for a link.
 */
const CATEGORY_TEXT_CLASS: Record<HostedCompetitionCategory, string> = {
  elementary: 'text-emerald-200',
  intermediate: 'text-amber-200',
  advanced: 'text-rose-200',
}

/**
 * The ink a label carries for a level: the level's hue, or the page's own for something outside the levels.
 *
 * @param category - The level; null for none.
 *
 * @returns The text class.
 */
export function categoryTextClass(category: HostedCompetitionCategory | null): string {
  // The page's own text colour outside the levels, else the level's hue
  return category === null ? 'text-foreground' : CATEGORY_TEXT_CLASS[category]
}

/** The tint behind a level's name, in the level's hue. */
const CATEGORY_TINT_CLASS: Record<HostedCompetitionCategory, string> = {
  elementary: 'bg-emerald-400/10',
  intermediate: 'bg-amber-400/10',
  advanced: 'bg-rose-400/10',
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
        CATEGORY_TINT_CLASS[category],
        CATEGORY_TEXT_CLASS[category]
      )}
    >
      {categoryName(category)}
    </span>
  )
}
