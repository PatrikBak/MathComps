'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'

import type { HostedCompetitionCategory } from '../model/hosted-competition-types'

/**
 * What each level is called in the reader's language.
 *
 * @returns A function which names a level.
 */
export function useCategoryName(): (category: HostedCompetitionCategory) => string {
  // The levels' own copy
  const t = useTranslations('competitions.categories')

  // A function which names one
  return useCallback(
    (category: HostedCompetitionCategory) => {
      switch (category) {
        // The easiest of the three
        case 'elementary':
          return t('elementary')

        // The middle one
        case 'intermediate':
          return t('intermediate')

        // The hardest
        case 'advanced':
          return t('advanced')

        // Every level is handled above
        default:
          return assertNever(category)
      }
    },
    [t]
  )
}
