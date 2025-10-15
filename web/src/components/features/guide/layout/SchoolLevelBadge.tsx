import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { GUIDE_STYLES } from './guide-styles'

export type SchoolLevel = 'ZŠ' | 'SŠ'

type SchoolLevelBadgeProps = {
  level: SchoolLevel
}

export function SchoolLevelBadge({ level }: SchoolLevelBadgeProps) {
  return (
    <span
      className={cn(
        'text-sm font-semibold',
        {
          ZŠ: GUIDE_STYLES.elementaryColor,
          SŠ: GUIDE_STYLES.highSchoolColor,
        }[level]
      )}
    >
      {level}
    </span>
  )
}
