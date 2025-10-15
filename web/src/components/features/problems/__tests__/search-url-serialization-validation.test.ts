import { describe, expect, it } from 'vitest'

import type { SearchFiltersState } from '../types/problem-library-types'
import { deserializeFilters, serializeFilters } from '../utils/search-url-serialization'

describe('URL Parameter Validation', () => {
  describe('Invalid parameter detection', () => {
    it('should return null for completely unknown parameters', () => {
      const result = deserializeFilters('test=5')
      expect(result).toBeNull()
    })

    it('should return null for mix of valid and invalid parameters', () => {
      const result = deserializeFilters('q=algebra&invalidParam=value')
      expect(result).toBeNull()
    })

    it('should return null for invalid parameters with problem ID', () => {
      const result = deserializeFilters('id=75-a-i-5&extraParam=bad')
      expect(result).toBeNull()
    })

    it('should return null for multiple invalid parameters', () => {
      const result = deserializeFilters('foo=bar&baz=qux')
      expect(result).toBeNull()
    })

    it('should return null for typo in valid parameter name', () => {
      const result = deserializeFilters('serachText=algebra')
      expect(result).toBeNull()
    })
  })

  describe('Valid parameter acceptance', () => {
    it('should accept empty query string', () => {
      const result = deserializeFilters('')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result.searchText).toBe('')
      }
    })

    it('should accept all valid filter parameters', () => {
      const query =
        'q=algebra&searchInSolution=true&seasons=2023&problemNumbers=1,2&tags=combinatorics&tagLogic=and&authors=john&authorLogic=or&competitions=csmo'
      const result = deserializeFilters(query)
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result).toHaveProperty('searchText')
        expect(result).toHaveProperty('searchInSolution')
        expect(result).toHaveProperty('seasons')
      }
    })

    it('should accept only problem ID', () => {
      const result = deserializeFilters('id=75-a-i-5')
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('problemId', '75-a-i-5')
    })

    it('should accept single valid parameter', () => {
      const result = deserializeFilters('q=geometry')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result.searchText).toBe('geometry')
      }
    })
  })

  describe('Round-trip serialization', () => {
    it('should preserve all filter data through serialize -> deserialize', () => {
      const originalFilters: SearchFiltersState = {
        searchText: 'test query',
        searchInSolution: true,
        seasons: [{ slug: '2023', displayName: '2023' }],
        problemNumbers: [1, 2, 3],
        tags: [
          { slug: 'algebra', displayName: 'Algebra' },
          { slug: 'geometry', displayName: 'Geometry' },
        ],
        tagLogic: 'and',
        authors: [
          { slug: 'john-doe', displayName: 'John Doe' },
          { slug: 'jane-smith', displayName: 'Jane Smith' },
        ],
        authorLogic: 'or',
        contestSelection: [],
      }

      const serialized = serializeFilters(originalFilters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized).not.toBeNull()
      expect(deserialized).not.toHaveProperty('problemId')
      if (deserialized && 'searchText' in deserialized) {
        expect(deserialized.searchText).toBe(originalFilters.searchText)
        expect(deserialized.searchInSolution).toBe(originalFilters.searchInSolution)
        expect(deserialized.seasons).toHaveLength(1)
        expect(deserialized.problemNumbers).toEqual(originalFilters.problemNumbers)
        expect(deserialized.tagLogic).toBe(originalFilters.tagLogic)
        expect(deserialized.authorLogic).toBe(originalFilters.authorLogic)
      }
    })

    it('should handle empty filters', () => {
      const emptyFilters: SearchFiltersState = {
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

      const serialized = serializeFilters(emptyFilters)
      const deserialized = deserializeFilters(serialized)

      expect(deserialized).not.toBeNull()
      expect(deserialized).not.toHaveProperty('problemId')
      if (deserialized && 'searchText' in deserialized) {
        expect(deserialized.searchText).toBe('')
        expect(deserialized.searchInSolution).toBe(false)
        expect(deserialized.seasons).toHaveLength(0)
        expect(deserialized.problemNumbers).toHaveLength(0)
        expect(deserialized.tags).toHaveLength(0)
        expect(deserialized.tagLogic).toBe('or')
        expect(deserialized.authors).toHaveLength(0)
        expect(deserialized.authorLogic).toBe('or')
        expect(deserialized.competitionSelectionParts).toHaveLength(0)
      }
    })

    it('should apply smart compression for single tags and authors', () => {
      const filtersWithSingleItems: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        problemNumbers: [],
        tags: [{ slug: 'delitelnost', displayName: 'Deliteľnosť' }],
        tagLogic: 'and', // Should be omitted in URL
        authors: [{ slug: 'john-doe', displayName: 'John Doe' }],
        authorLogic: 'and', // Should be omitted in URL
        contestSelection: [],
      }

      const serialized = serializeFilters(filtersWithSingleItems)
      const deserialized = deserializeFilters(serialized)

      expect(serialized).toBe('tags=delitelnost&authors=john-doe')
      expect(serialized).not.toContain('tagLogic')
      expect(serialized).not.toContain('authorLogic')

      expect(deserialized).not.toBeNull()
      if (deserialized && 'searchText' in deserialized) {
        expect(deserialized.tags).toHaveLength(1)
        expect(deserialized.tagLogic).toBe('or') // Should default to 'or'
        expect(deserialized.authors).toHaveLength(1)
        expect(deserialized.authorLogic).toBe('or') // Should default to 'or'
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle URL-encoded special characters', () => {
      const result = deserializeFilters('q=' + encodeURIComponent('test & special < >'))
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result.searchText).toBe('test & special < >')
      }
    })

    it('should handle malformed numbers in problemNumbers', () => {
      const result = deserializeFilters('problemNumbers=1,abc,3')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'problemNumbers' in result) {
        expect(result.problemNumbers).toEqual([1, 3]) // abc filtered out
      }
    })

    it('should handle empty parameter values', () => {
      const result = deserializeFilters('q=&seasons=')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result.searchText).toBe('')
        expect(result.seasons).toEqual([])
      }
    })

    it('should reject parameter names with case variations', () => {
      // Our parameters are case-sensitive
      const result = deserializeFilters('Q=algebra') // uppercase Q
      expect(result).toBeNull()
    })

    it('should handle duplicate parameter names (URLSearchParams takes first)', () => {
      const result = deserializeFilters('q=first&q=second')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result.searchText).toBe('first')
      }
    })
  })

  describe('Security and validation', () => {
    it('should not execute any code from parameters', () => {
      const result = deserializeFilters('q=<script>alert("xss")</script>')
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        // Should treat it as plain text
        expect(result.searchText).toBe('<script>alert("xss")</script>')
      }
    })

    it('should handle very long parameter values', () => {
      const longString = 'a'.repeat(10000)
      const result = deserializeFilters(`q=${longString}`)
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'searchText' in result) {
        expect(result.searchText).toBe(longString)
      }
    })

    it('should handle many parameters', () => {
      const manySeasons = Array.from({ length: 100 }, (_, i) => `s${i}`).join(',')
      const result = deserializeFilters(`seasons=${manySeasons}`)
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('problemId')
      if (result && 'seasons' in result) {
        expect(result.seasons).toHaveLength(100)
      }
    })
  })
})
