import { describe, expect, it } from 'vitest'

import type { SearchFiltersState } from '../types/problem-library-types'
import { deserializeFilters, serializeFilters } from '../utils/search-url-serialization'

describe('Search URL Serialization', () => {
  const mockFilters: SearchFiltersState = {
    searchText: 'algebra',
    searchInSolution: true,
    seasons: [{ displayName: 'Season 1', slug: 'season-1' }],
    problemNumbers: [1, 5, 10],
    tags: [
      { displayName: 'Combinatorics', slug: 'combinatorics' },
      { displayName: 'Geometry', slug: 'geometry' },
    ],
    tagLogic: 'and',
    authors: [{ displayName: 'John Doe', slug: 'john-doe' }],
    authorLogic: 'or',
    contestSelection: [
      {
        type: 'round',
        competitionSlug: 'csmo',
        categorySlug: 'a',
        roundSlug: 'i',
        displayName: 'Matematická Olympiáda - A - Domáce kolo',
      },
    ],
  }

  it('should correctly serialize a complex filter object', () => {
    const serialized = serializeFilters(mockFilters)
    expect(serialized).toBeTypeOf('string')
    expect(serialized).not.toHaveLength(0)
    expect(serialized).toContain('q=algebra')
    expect(serialized).toContain('searchInSolution=true')
    expect(serialized).toContain('tags=combinatorics,geometry')
    expect(serialized).toContain('tagLogic=and')
    expect(serialized).toContain('competitions=csmo-a-i')
  })

  it('should correctly deserialize a complex filter object', () => {
    const serialized = serializeFilters(mockFilters)
    const deserialized = deserializeFilters(serialized)

    expect(deserialized).not.toBeNull()
    expect(deserialized).not.toHaveProperty('problemId')

    if (deserialized && 'searchText' in deserialized) {
      expect(deserialized.searchText).toBe(mockFilters.searchText)
      expect(deserialized.searchInSolution).toBe(mockFilters.searchInSolution)
      expect(deserialized.seasons.map((s) => s.slug)).toEqual(
        mockFilters.seasons.map((s) => s.slug)
      )
      expect(deserialized.problemNumbers).toEqual(mockFilters.problemNumbers)
      expect(deserialized.tags.map((t) => t.slug)).toEqual(mockFilters.tags.map((t) => t.slug))
      expect(deserialized.tagLogic).toBe(mockFilters.tagLogic)
      expect(deserialized.authors.map((a) => a.slug)).toEqual(
        mockFilters.authors.map((a) => a.slug)
      )
      expect(deserialized.authorLogic).toBe(mockFilters.authorLogic)
      expect(deserialized.competitionSelectionParts).toEqual([['csmo', 'a', 'i']])
    }
  })

  it('should handle an empty filter object', () => {
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
    expect(serialized).toHaveLength(0)
    expect(deserialized).not.toBeNull()
    if (deserialized && 'competitionSelectionParts' in deserialized) {
      expect(deserialized.competitionSelectionParts).toEqual([])
    }
  })

  it('should reject URLs with invalid parameters', () => {
    const malformedString = 'q=test&invalidParam=value&problemNumbers=1,2,invalid,4'
    const deserialized = deserializeFilters(malformedString)
    // URLs with unrecognized parameters are rejected for security/correctness
    expect(deserialized).toBeNull()
  })

  it('should deserialize mixed selection types into raw parts', () => {
    const mixedUrl = 'competitions=csmo,csmo-a,csmo-b-s,imo'
    const deserialized = deserializeFilters(mixedUrl)
    expect(deserialized).not.toBeNull()
    if (deserialized && 'competitionSelectionParts' in deserialized) {
      expect(deserialized.competitionSelectionParts).toEqual([
        ['csmo'],
        ['csmo', 'a'],
        ['csmo', 'b', 's'],
        ['imo'],
      ])
    }
  })

  it('should deserialize direct rounds correctly', () => {
    const url = 'competitions=cpsj-i,csmo-a-i'
    const deserialized = deserializeFilters(url)
    expect(deserialized).not.toBeNull()
    if (deserialized && 'competitionSelectionParts' in deserialized) {
      expect(deserialized.competitionSelectionParts).toEqual([
        ['cpsj', 'i'],
        ['csmo', 'a', 'i'],
      ])
    }
  })

  it('should serialize direct rounds without double dashes', () => {
    const filters: SearchFiltersState = {
      searchText: '',
      searchInSolution: false,
      seasons: [],
      problemNumbers: [],
      tags: [],
      tagLogic: 'or',
      authors: [],
      authorLogic: 'or',
      contestSelection: [
        {
          type: 'round',
          competitionSlug: 'cpsj',
          roundSlug: 'i',
          displayName: 'CPSJ - Individuálna súťaž',
        },
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'i',
          displayName: 'ČSMO - A - Domáce kolo',
        },
      ],
    }
    const serialized = serializeFilters(filters)
    expect(serialized).toBe('competitions=cpsj-i,csmo-a-i')
    expect(serialized).not.toContain('--')
  })
})
