import { describe, expect, it } from 'vitest'

import {
  isNoOpFilterChange,
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
    favoritesOnly: false,
    markStatus: null,
    listContentId: null,
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

    it('should trigger search if favoritesOnly is active, even with short text', () => {
      const favoritesWithShortText = {
        ...mockInitialFilters,
        searchText: 'x',
        favoritesOnly: true,
      }
      expect(shouldTriggerSearch(favoritesWithShortText)).toBe(true)
    })

    it('should trigger search if listContentId is active, even with short text', () => {
      const listWithShortText = {
        ...mockInitialFilters,
        searchText: 'x',
        listContentId: 'abc123',
      }
      expect(shouldTriggerSearch(listWithShortText)).toBe(true)
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

    it('should detect favoritesOnly change as a discrete filter change', () => {
      const baseFilters = { ...mockInitialFilters, searchText: 'existing search' }
      const favoritesChange = { ...baseFilters, favoritesOnly: true }
      expect(isTextOnlyChange(baseFilters, favoritesChange)).toBe(false)
    })

    it('should detect listContentId change as a discrete filter change', () => {
      const baseFilters = { ...mockInitialFilters, searchText: 'existing search' }
      const listChange = { ...baseFilters, listContentId: 'abc123' }
      expect(isTextOnlyChange(baseFilters, listChange)).toBe(false)
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

  describe('isNoOpFilterChange - No-Op Filter Detection', () => {
    it('should detect tagLogic toggle as no-op with 0 tags', () => {
      const before = { ...mockInitialFilters, tagLogic: 'or' as const }
      const after = { ...mockInitialFilters, tagLogic: 'and' as const }
      expect(isNoOpFilterChange(before, after)).toBe(true)
    })

    it('should detect tagLogic toggle as no-op with 1 tag', () => {
      const before = {
        ...mockInitialFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        tagLogic: 'or' as const,
      }
      const after = {
        ...mockInitialFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        tagLogic: 'and' as const,
      }
      expect(isNoOpFilterChange(before, after)).toBe(true)
    })

    it('should NOT detect tagLogic toggle as no-op with 2+ tags', () => {
      const twoTags = [
        { slug: 'algebra', displayName: 'Algebra' },
        { slug: 'geometry', displayName: 'Geometry' },
      ]
      const before = { ...mockInitialFilters, tags: twoTags, tagLogic: 'or' as const }
      const after = { ...mockInitialFilters, tags: twoTags, tagLogic: 'and' as const }
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('should detect authorLogic toggle as no-op with 0-1 authors', () => {
      const before = { ...mockInitialFilters, authorLogic: 'or' as const }
      const after = { ...mockInitialFilters, authorLogic: 'and' as const }
      expect(isNoOpFilterChange(before, after)).toBe(true)
    })

    it('should NOT detect authorLogic toggle as no-op with 2+ authors', () => {
      const twoAuthors = [
        { slug: 'alice', displayName: 'Alice' },
        { slug: 'bob', displayName: 'Bob' },
      ]
      const before = { ...mockInitialFilters, authors: twoAuthors, authorLogic: 'or' as const }
      const after = { ...mockInitialFilters, authors: twoAuthors, authorLogic: 'and' as const }
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('should NOT treat a tag addition as a no-op', () => {
      const before = { ...mockInitialFilters }
      const after = {
        ...mockInitialFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
      }
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('should NOT treat a list switch as a no-op', () => {
      const before = { ...mockInitialFilters, listContentId: 'list-a' }
      const after = { ...mockInitialFilters, listContentId: 'list-b' }
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('should detect identical filters as a no-op', () => {
      expect(isNoOpFilterChange(mockInitialFilters, { ...mockInitialFilters })).toBe(true)
    })
  })
})
