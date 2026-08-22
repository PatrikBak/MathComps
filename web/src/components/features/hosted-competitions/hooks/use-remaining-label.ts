'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { splitRemaining } from '@/components/shared/utils/duration-utils'

/**
 * Wording for how long is left, at the scale the answer falls in: the two fields on show follow the span
 * down rather than printing a fixed shape.
 *
 * @returns A function which words the time left until an instant.
 */
export function useRemainingLabel(): (deadline: string, now: number) => string {
  // Competitions copy
  const t = useTranslations('competitions')

  // A function which words a span
  return useCallback(
    (deadline: string, now: number) => {
      // How long is left, in the fields a deadline is read in
      const parts = splitRemaining(Date.parse(deadline) - now)

      // Days out, where hours are as fine as anyone plans
      if (parts.days > 0) {
        return t('remainingDays', { days: parts.days, hours: parts.hours })
      }

      // Inside the last day, where the minutes start to matter
      if (parts.hours > 0) {
        return t('remainingHours', { hours: parts.hours, minutes: parts.minutes })
      }

      // Inside the last hour, down to the seconds
      return t('remainingMinutes', { minutes: parts.minutes, seconds: parts.seconds })
    },
    [t]
  )
}
