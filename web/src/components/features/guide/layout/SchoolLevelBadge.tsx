import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

import { SCHOOL_LEVEL_COLORS } from '../guide-colors'

/**
 * School level type - uses internal keys for data, translations for display.
 */
export type SchoolLevel = 'elementary' | 'highSchool'

/**
 * Props for the {@link SchoolLevelBadge} component.
 */
type SchoolLevelBadgeProps = {
  /** School level to display */
  level: SchoolLevel
}

/**
 * A badge that displays a school level such as elementary or high school.
 */
export function SchoolLevelBadge({ level }: SchoolLevelBadgeProps) {
  // Get the translations for the school levels
  const t = useTranslations('guide.schoolLevels')

  // Get the CSS color class for the school level
  const color = SCHOOL_LEVEL_COLORS[level]

  // Return the badge
  return <span className={cn('text-sm font-semibold', color)}>{t(level)}</span>
}
