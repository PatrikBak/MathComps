'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { HOUR_MINUTES } from '@/components/shared/utils/time-units'

/**
 * Wording for how long a competition's clock runs.
 *
 * @returns A function which words a clock length given in minutes.
 */
export function useClockLength(): (clockMinutes: number) => string {
  // Competitions copy
  const t = useTranslations('competitions')

  // A function which words a clock length
  return useCallback(
    (clockMinutes: number) => {
      // The two fields a length is read in
      const hours = Math.floor(clockMinutes / HOUR_MINUTES)
      const minutes = clockMinutes % HOUR_MINUTES

      // Under an hour there is no hours field to print, and a whole hour has no minutes field
      if (hours === 0) {
        return t('clockMinutes', { minutes })
      }

      // Whole hours, or hours and the minutes over
      return minutes === 0 ? t('clockHours', { hours }) : t('clockHoursMinutes', { hours, minutes })
    },
    [t]
  )
}
