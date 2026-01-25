import { describe, expect, it } from 'vitest'

import type { SearchFiltersState } from '../types/problem-library-types'
import { deserializeFilters, serializeFilters } from '../utils/search-url-serialization'

/**
 * Creates a minimal SearchFiltersState with defaults
 */
const createFilters = (overrides: Partial<SearchFiltersState>): SearchFiltersState => ({
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
  ...overrides,
})

describe('Search URL Serialization', () => {
  describe('Round-trip serialization', () => {
    it('should serialize and deserialize all filter types', () => {
      const filters = createFilters({
        searchText: 'algebra',
        searchInSolution: true,
        seasons: [{ displayName: '2023', slug: '2023' }],
        problemNumbers: [1, 5, 10],
        tags: [
          { displayName: 'Combinatorics', slug: 'combinatorics' },
          { displayName: 'Geometry', slug: 'geometry' },
        ],
        tagLogic: 'and',
        authors: [{ displayName: 'John Doe', slug: 'john-doe' }],
        contestSelection: [
          {
            type: 'round',
            competitionSlug: 'imo',
            categorySlug: 'a',
            roundSlug: 'finals',
            displayName: 'IMO - A - Finals',
          },
        ],
        favoritesOnly: true,
      })

      const serialized = serializeFilters(filters)
      const deserialized = deserializeFilters(serialized)

      expect(serialized).toContain('q=algebra')
      expect(serialized).toContain('searchInSolution=true')
      expect(serialized).toContain('tags=combinatorics,geometry')
      expect(serialized).toContain('tagLogic=and')
      expect(serialized).toContain('competitions=imo-a-finals')
      expect(serialized).toContain('favoritesOnly=true')

      expect(deserialized).not.toBeNull()
      expect(deserialized?.searchText).toBe('algebra')
      expect(deserialized?.tags.map((t) => t.slug)).toEqual(['combinatorics', 'geometry'])
      expect(deserialized?.competitionSelectionParts).toEqual([['imo', 'a', 'finals']])
    })

    it('should omit default values from URL', () => {
      const filters = createFilters({
        searchText: 'test',
        searchInSolution: false, // default
        tagLogic: 'or', // default
        favoritesOnly: false, // default
      })

      const serialized = serializeFilters(filters)

      expect(serialized).toBe('q=test')
      expect(serialized).not.toContain('searchInSolution')
      expect(serialized).not.toContain('tagLogic')
      expect(serialized).not.toContain('favoritesOnly')
    })

    it('should produce empty string for default filters', () => {
      const filters = createFilters({})

      expect(serializeFilters(filters)).toBe('')
    })
  })

  describe('Competition hierarchy serialization', () => {
    it('should serialize competition-only selection', () => {
      const filters = createFilters({
        contestSelection: [{ type: 'competition', competitionSlug: 'imo', displayName: 'IMO' }],
      })

      expect(serializeFilters(filters)).toBe('competitions=imo')
    })

    it('should serialize category selection (competition-category)', () => {
      const filters = createFilters({
        contestSelection: [
          {
            type: 'category',
            competitionSlug: 'imo',
            categorySlug: 'a',
            displayName: 'IMO - A',
          },
        ],
      })

      expect(serializeFilters(filters)).toBe('competitions=imo-a')
    })

    it('should serialize round without category (competition-round)', () => {
      const filters = createFilters({
        contestSelection: [
          {
            type: 'round',
            competitionSlug: 'imo',
            roundSlug: 'finals',
            displayName: 'IMO - Finals',
          },
        ],
      })

      const serialized = serializeFilters(filters)

      expect(serialized).toBe('competitions=imo-finals')
      expect(serialized).not.toContain('--') // No double dash
    })

    it('should deserialize mixed hierarchy levels', () => {
      const deserialized = deserializeFilters('competitions=imo,imo-a,imo-a-finals')

      expect(deserialized?.competitionSelectionParts).toEqual([
        ['imo'],
        ['imo', 'a'],
        ['imo', 'a', 'finals'],
      ])
    })
  })

  describe('URL compression', () => {
    it('should omit logic param when single item selected', () => {
      const filters = createFilters({
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        tagLogic: 'and', // Would be meaningless with 1 tag
      })

      const url = serializeFilters(filters)

      expect(url).toBe('tags=algebra')
      expect(url).not.toContain('tagLogic')
    })

    it('should include logic param when multiple items with non-default', () => {
      const filters = createFilters({
        tags: [
          { slug: 'algebra', displayName: 'Algebra' },
          { slug: 'geometry', displayName: 'Geometry' },
        ],
        tagLogic: 'and',
      })

      expect(serializeFilters(filters)).toBe('tags=algebra,geometry&tagLogic=and')
    })
  })

  describe('Invalid parameter rejection', () => {
    it('should reject unknown parameters', () => {
      expect(deserializeFilters('unknownParam=value')).toBeNull()
    })

    it('should reject case variations (params are case-sensitive)', () => {
      expect(deserializeFilters('Q=algebra')).toBeNull()
    })

    it('should reject id param (handled by hasProblemId)', () => {
      expect(deserializeFilters('id=75-a-i-5')).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should handle URL-encoded special characters', () => {
      const result = deserializeFilters('q=' + encodeURIComponent('x + y = z'))

      expect(result?.searchText).toBe('x + y = z')
    })

    it('should filter out non-numeric problem numbers', () => {
      const result = deserializeFilters('problemNumbers=1,abc,3')

      expect(result?.problemNumbers).toEqual([1, 3])
    })
  })
})
