'use client'

import { useCallback } from 'react'

import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { RecommendationTarget } from '../model/recommendation-targets'

/**
 * What each recommendation target is called in the reader's language: a category that is a hosted level by the
 * level's own name, any other by the name its organization gives it, and a paper by its own name.
 *
 * @returns A function which names a target.
 */
export function useRecommendationTargetName(): (target: RecommendationTarget) => string {
  // What each hosted level is called
  const levelName = useCategoryName()

  // A function which names a target
  return useCallback(
    (target: RecommendationTarget) => {
      // By the kind of target
      switch (target.kind) {
        case 'category': {
          // The hosted level the category is, if any
          const level = target.category.hostedCategory

          // The level's name, else the category's own
          return level === null ? target.category.name : levelName(level)
        }
        case 'paper':
          return target.paper.name

        // Every kind is handled above
        default:
          return assertNever(target)
      }
    },
    [levelName]
  )
}
