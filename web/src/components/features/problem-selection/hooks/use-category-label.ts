'use client'

import { useCallback } from 'react'

import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'

import { useSelectionWorkspace } from '../components/SelectionWorkspaceProvider'
import { hostedLevelOf } from '../model/selection-state'

/**
 * What each of the selection's categories is called in the reader's language: a category that is a hosted level by
 * the level's own name, any other by the name its organization gives it.
 *
 * @returns A function which names a category given by its name.
 */
export function useCategoryLabel(): (category: string) => string {
  // What each hosted level is called
  const levelName = useCategoryName()

  // The selection's categories, none until its read lands
  const categories = useSelectionWorkspace().selection?.categories

  // A function which names a category
  return useCallback(
    (category: string) => {
      // The hosted level the category is, where the selection lists it as one
      const level = hostedLevelOf(category, categories ?? [])

      // The level's name, else the category's own
      return level === null ? category : levelName(level)
    },
    [categories, levelName]
  )
}
