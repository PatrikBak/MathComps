import { describe, expect, it } from 'vitest'

import { type FacetOption } from '../facet-shared'
import { filterOptionsBySearch, getVisibleOptions } from '../utils/facet-logic'

describe('Facet Logic Utilities', () => {
  const mockOptions: FacetOption[] = [
    { id: 'algebra', displayName: 'Algebra', count: 25 },
    { id: 'geometry', displayName: 'Geometry', count: 18 },
    { id: 'number-theory', displayName: 'Number Theory', count: 12 },
    { id: 'combinatorics', displayName: 'Combinatorics', count: 8 },
    { id: 'probability', displayName: 'Probability', count: 5 },
    { id: 'disabled-tag', displayName: 'Disabled Tag', count: 0 },
  ]

  describe('getVisibleOptions - Complex Search + Selection Logic', () => {
    it('should implement the complex "show selected even if filtered out" behavior', () => {
      // This prevents user confusion when their selections "disappear" during search
      const selectedIds = new Set(['algebra', 'probability'])
      const visible = getVisibleOptions(mockOptions, selectedIds, 'geo')

      // Should include geometry (matches search) + algebra and probability (selected but don't match)
      expect(visible).toHaveLength(3)
      expect(visible.map((o) => o.id)).toContain('geometry') // Matches search
      expect(visible.map((o) => o.id)).toContain('algebra') // Selected, doesn't match
      expect(visible.map((o) => o.id)).toContain('probability') // Selected, doesn't match
    })

    it('should handle edge case where selected items overlap with search results', () => {
      const selectedIds = new Set(['geometry', 'algebra']) // geometry matches search, algebra doesn't
      const visible = getVisibleOptions(mockOptions, selectedIds, 'geo')

      // Should not duplicate geometry
      expect(visible).toHaveLength(2)
      expect(visible.filter((o) => o.id === 'geometry')).toHaveLength(1) // Only one instance
      expect(visible.map((o) => o.id)).toContain('algebra') // Still shows selected non-match
    })
  })

  describe('filterOptionsBySearch - Case and Diacritics Insensitivity', () => {
    const optionsWithDiacritics: FacetOption[] = [
      { id: '1', displayName: 'Čísla', count: 10 },
      { id: '2', displayName: 'Rovnice', count: 15 },
      { id: '3', displayName: 'Štatistika', count: 8 },
      { id: '4', displayName: 'Trigonometria', count: 12 },
      { id: '5', displayName: 'Štvorec', count: 5 },
      { id: '6', displayName: 'Čiara', count: 3 },
    ]

    it('should return all options when search term is empty', () => {
      const result = filterOptionsBySearch(optionsWithDiacritics, '')
      expect(result).toHaveLength(optionsWithDiacritics.length)
      expect(result).toEqual(optionsWithDiacritics)
    })

    it('should perform case-insensitive search', () => {
      // Search with lowercase, should match "Rovnice"
      const result = filterOptionsBySearch(optionsWithDiacritics, 'rovnice')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')

      // Search with uppercase
      const resultUpper = filterOptionsBySearch(optionsWithDiacritics, 'ROVNICE')
      expect(resultUpper).toHaveLength(1)
      expect(resultUpper[0].id).toBe('2')
    })

    it('should perform diacritics-insensitive search', () => {
      // Search for "Cisla" (without diacritics), should match "Čísla"
      const result = filterOptionsBySearch(optionsWithDiacritics, 'cisla')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')

      // Search for "Statistika" (without diacritics), should match "Štatistika"
      const resultStatistika = filterOptionsBySearch(optionsWithDiacritics, 'statistika')
      expect(resultStatistika).toHaveLength(1)
      expect(resultStatistika[0].id).toBe('3')

      // Search for "Ciara" (without diacritics), should match "Čiara"
      const resultCiara = filterOptionsBySearch(optionsWithDiacritics, 'ciara')
      expect(resultCiara).toHaveLength(1)
      expect(resultCiara[0].id).toBe('6')
    })

    it('should perform combined case and diacritics-insensitive search', () => {
      // Search for uppercase without diacritics, should match "Čísla"
      const result = filterOptionsBySearch(optionsWithDiacritics, 'CISLA')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')

      // Search for mixed case without diacritics
      const resultMixed = filterOptionsBySearch(optionsWithDiacritics, 'StAtIsTiKa')
      expect(resultMixed).toHaveLength(1)
      expect(resultMixed[0].id).toBe('3')
    })

    it('should match partial strings', () => {
      // Search for partial match with diacritics
      const result = filterOptionsBySearch(optionsWithDiacritics, 'Štvo')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('5')

      // Search for partial match without diacritics
      const resultNoDiacritics = filterOptionsBySearch(optionsWithDiacritics, 'stvo')
      expect(resultNoDiacritics).toHaveLength(1)
      expect(resultNoDiacritics[0].id).toBe('5')
    })

    it('should handle multiple matches', () => {
      // Both "Štvorec" and "Štatistika" start with "Št"
      const result = filterOptionsBySearch(optionsWithDiacritics, 'st')
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.map((option) => option.id)).toContain('3') // Štatistika
      expect(result.map((option) => option.id)).toContain('5') // Štvorec
    })

    it('should return empty array when no matches found', () => {
      const result = filterOptionsBySearch(optionsWithDiacritics, 'xyz')
      expect(result).toHaveLength(0)
    })
  })
})
