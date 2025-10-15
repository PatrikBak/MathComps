import { describe, expect, it } from 'vitest'

import {
  isTextOnlyChange,
  shouldTriggerSearch,
} from '@/components/features/problems/utils/search-logic'

import type { ContestSelection, SearchFiltersState } from '../types/problem-library-types'

// Test the core search logic functions used by the useProblemSearch hook
describe('Problem Search Logic', () => {
  const mockInitialFilters: SearchFiltersState = {
    searchText: '',
    searchInSolution: false,
    seasons: [],
    problemNumbers: [],
    tags: [],
    tagLogic: 'or',
    authors: [],
    authorLogic: 'or',
    contestSelection: [],
  }

  describe('shouldTriggerSearch - Complex Search Threshold Logic', () => {
    it('should implement 3-character threshold rule with override logic', () => {
      const shortTextOnly = { ...mockInitialFilters, searchText: 'ab' }
      expect(shouldTriggerSearch(shortTextOnly)).toBe(false)

      // But other filters override the 3-character rule
      const shortTextWithFilters = {
        ...mockInitialFilters,
        searchText: 'ab',
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
      }
      expect(shouldTriggerSearch(shortTextWithFilters)).toBe(true)
    })

    it('should handle complex filter combinations that override text threshold', () => {
      const complexFiltersWithShortText = {
        ...mockInitialFilters,
        searchText: 'x', // Single character
        seasons: [{ slug: '2023', displayName: '2023' }],
        problemNumbers: [1, 2, 3],
        contestSelection: [
          {
            type: 'category' as const,
            competitionSlug: 'mo',
            categorySlug: 'a',
            displayName: 'MO - A',
          },
        ],
      }
      expect(shouldTriggerSearch(complexFiltersWithShortText)).toBe(true)
    })
  })

  describe('isTextOnlyChange - Complex Filter Classification Logic', () => {
    it('should classify text-only changes for debouncing behavior', () => {
      const baseFilters = {
        ...mockInitialFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        contestSelection: [
          {
            type: 'category' as const,
            competitionSlug: 'mo',
            categorySlug: 'a',
            displayName: 'MO - A',
          },
        ],
      }

      // Text field changes should be debounced
      const textChange = { ...baseFilters, searchText: 'new search' }
      expect(isTextOnlyChange(baseFilters, textChange)).toBe(true)

      const solutionChange = { ...baseFilters, searchInSolution: true }
      expect(isTextOnlyChange(baseFilters, solutionChange)).toBe(true)

      // Both text changes simultaneously
      const bothTextChanges = { ...baseFilters, searchText: 'test', searchInSolution: true }
      expect(isTextOnlyChange(baseFilters, bothTextChanges)).toBe(true)
    })

    it('should detect discrete filter changes that require immediate search', () => {
      const baseFilters = { ...mockInitialFilters, searchText: 'existing search' }

      // Any discrete filter change should trigger immediate search
      const tagChange = { ...baseFilters, tags: [{ slug: 'new-tag', displayName: 'New Tag' }] }
      expect(isTextOnlyChange(baseFilters, tagChange)).toBe(false)

      const mixedChange = {
        ...baseFilters,
        searchText: 'different search',
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
      }
      expect(isTextOnlyChange(baseFilters, mixedChange)).toBe(false)
    })

    it('should handle complex selections array comparison logic', () => {
      const withSelections = {
        ...mockInitialFilters,
        contestSelection: [
          {
            type: 'round' as const,
            competitionSlug: 'mo',
            categorySlug: 'a',
            roundSlug: 'i',
            displayName: 'MO - A - I',
          },
        ],
      }

      // Different selections structure should trigger discrete change
      const differentSelections = {
        ...withSelections,
        contestSelection: [
          {
            type: 'competition' as const,
            competitionSlug: 'imo',
            displayName: 'IMO',
          },
        ],
      }
      expect(isTextOnlyChange(withSelections, differentSelections)).toBe(false)

      // Edge case: undefined vs empty arrays
      const undefinedSelections = {
        ...mockInitialFilters,
        contestSelection: undefined as unknown as ContestSelection[],
      }
      const emptySelections = { ...mockInitialFilters, contestSelection: [] }
      expect(isTextOnlyChange(undefinedSelections, emptySelections)).toBe(false)
    })
  })
})
