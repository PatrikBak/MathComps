'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'

import type { ProposalArea } from '../model/selection-types'

/**
 * What each area is called in the reader's language.
 *
 * @returns A function which names an area.
 */
export function useAreaName(): (area: ProposalArea) => string {
  // The areas' own copy
  const t = useTranslations('problemSelection.areas')

  // A function which names an area
  return useCallback(
    (area: ProposalArea) => {
      // Each area by its own name
      switch (area) {
        case 'algebra':
          return t('algebra')
        case 'combinatorics':
          return t('combinatorics')
        case 'geometry':
          return t('geometry')
        case 'numberTheory':
          return t('numberTheory')

        // Every area is handled above
        default:
          return assertNever(area)
      }
    },
    [t]
  )
}
