import { describe, expect, it } from 'vitest'

import type { SearchFiltersState } from '../types/problem-library-types'
import { deserializeFilters, serializeFilters } from '../utils/search-url-serialization'

/**
 * Builds a {@link SearchFiltersState} with nothing filtered on beyond the given overrides.
 *
 * @param overrides - The filters the case is about.
 * @returns The filter state.
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
  markStatus: null,
  listContentId: null,
  ...overrides,
})

describe('Search URL Serialization', () => {
  describe('The filters a URL carries', () => {
    it('should serialize and deserialize all filter types', () => {
      // Every filter set at once, so none of them can hide behind a default
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
        contestSelection: [{ path: 'imo-a-finals' }],
        favoritesOnly: true,
      })

      // The filters written out
      const serialized = serializeFilters(filters)

      // And that same string read straight back
      const deserialized = deserializeFilters(serialized)

      // Each filter in the query string under its own key
      expect(serialized).toContain('q=algebra')
      expect(serialized).toContain('searchInSolution=true')
      expect(serialized).toContain('tags=combinatorics,geometry')
      expect(serialized).toContain('tagLogic=and')
      expect(serialized).toContain('competitions=imo-a-finals')
      expect(serialized).toContain('favoritesOnly=true')

      // And every one of them understood on the way back
      expect(deserialized).not.toBeNull()
      expect(deserialized?.searchText).toBe('algebra')
      expect(deserialized?.tags.map((tag) => tag.slug)).toEqual(['combinatorics', 'geometry'])
      expect(deserialized?.contestPaths).toEqual(['imo-a-finals'])
    })

    it('should omit default values from URL', () => {
      // A term, with everything else left where it starts
      const filters = createFilters({
        searchText: 'test',
        searchInSolution: false,
        tagLogic: 'or',
        favoritesOnly: false,
      })

      // The filters written out
      const serialized = serializeFilters(filters)

      // Only the term survives, since a default says nothing a reader has to be told
      expect(serialized).toBe('q=test')
      expect(serialized).not.toContain('searchInSolution')
      expect(serialized).not.toContain('tagLogic')
      expect(serialized).not.toContain('favoritesOnly')
      expect(serialized).not.toContain('list')
    })

    it('should serialize and deserialize list param', () => {
      // One list being browsed, and nothing else
      const filters = createFilters({ listContentId: 'abc123' })

      // The filters written out
      const serialized = serializeFilters(filters)

      // The list is the whole query string
      expect(serialized).toBe('list=abc123')

      // The same string read back
      const deserialized = deserializeFilters(serialized)

      // Naming the list it went in as
      expect(deserialized?.listContentId).toBe('abc123')
    })

    it('should omit list param when null', () => {
      // The whole library rather than one list
      const filters = createFilters({ listContentId: null })

      // Nothing to say, so nothing is written
      expect(serializeFilters(filters)).toBe('')
    })

    it('should produce empty string for default filters', () => {
      // Nothing filtered on at all
      const filters = createFilters({})

      // A bare page, with no query string to carry
      expect(serializeFilters(filters)).toBe('')
    })
  })

  describe('Competition hierarchy serialization', () => {
    it('should serialize a selection at any depth as its bare path', () => {
      // Three contests, each naming a node at a different depth
      const filters = createFilters({
        contestSelection: [{ path: 'imo' }, { path: 'imo-a' }, { path: 'imo-a-i-navodne-x' }],
      })

      // Each written as the path it names, however deep that runs
      expect(serializeFilters(filters)).toBe('competitions=imo,imo-a,imo-a-i-navodne-x')
    })

    it('should deserialize mixed depths without interpreting them', () => {
      // The same three depths read back out of a query string
      const deserialized = deserializeFilters('competitions=imo,imo-a,imo-a-i-navodne-x')

      // Each path carried through whole, with nothing read into how deep it runs
      expect(deserialized?.contestPaths).toEqual(['imo', 'imo-a', 'imo-a-i-navodne-x'])
    })

    it('should drop empty segments so a hand-edited path still names its node', () => {
      // A doubled separator, a path that is nothing but a separator, and a trailing one
      const deserialized = deserializeFilters('competitions=imo--a,-,imo-')

      // Squeezed back to the nodes they were reaching for, and the empty one left off
      expect(deserialized?.contestPaths).toEqual(['imo-a', 'imo'])
    })
  })

  describe('URL compression', () => {
    it('should omit logic param when single item selected', () => {
      // One tag, under a mode that says nothing until a second tag joins it
      const filters = createFilters({
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        tagLogic: 'and',
      })

      // The filters written out
      const serialized = serializeFilters(filters)

      // The tag alone, with the mode left off
      expect(serialized).toBe('tags=algebra')
      expect(serialized).not.toContain('tagLogic')
    })

    it('should include logic param when multiple items with non-default', () => {
      // Two tags, matched all or nothing
      const filters = createFilters({
        tags: [
          { slug: 'algebra', displayName: 'Algebra' },
          { slug: 'geometry', displayName: 'Geometry' },
        ],
        tagLogic: 'and',
      })

      // The mode earns its place once it changes which problems match
      expect(serializeFilters(filters)).toBe('tags=algebra,geometry&tagLogic=and')
    })
  })

  describe('Invalid parameter rejection', () => {
    it('should reject unknown parameters', () => {
      // A key no filter answers to, which condemns the whole URL
      expect(deserializeFilters('unknownParam=value')).toBeNull()
    })

    it('should reject case variations (params are case-sensitive)', () => {
      // The term's own key, in the wrong case
      expect(deserializeFilters('Q=algebra')).toBeNull()
    })

    it('should reject the id param, which names no filter', () => {
      // A link to one problem rather than to a filtered library
      expect(deserializeFilters('id=75-a-i-5')).toBeNull()
    })
  })

  describe('Mark status serialization', () => {
    it('should serialize markStatus=marked to URL', () => {
      // Narrowed to what the user has marked
      const filters = createFilters({ markStatus: 'marked' })

      // Written as the only thing filtered on
      expect(serializeFilters(filters)).toBe('markStatus=marked')
    })

    it('should omit markStatus when null', () => {
      // The user not caring either way
      const filters = createFilters({ markStatus: null })

      // Nothing to say, so the key stays out of the URL
      expect(serializeFilters(filters)).not.toContain('markStatus')
    })

    it('should deserialize valid markStatus value', () => {
      // A value the filter offers
      const deserialized = deserializeFilters('markStatus=unmarked')

      // Taken as it stands
      expect(deserialized?.markStatus).toBe('unmarked')
    })

    it('should reject invalid markStatus value', () => {
      // A value the filter does not offer
      const deserialized = deserializeFilters('markStatus=invalid')

      // Read as not caring, rather than as a URL nobody can honour
      expect(deserialized?.markStatus).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should handle URL-encoded special characters', () => {
      // A term full of characters a URL cannot carry raw
      const deserialized = deserializeFilters('q=' + encodeURIComponent('x + y = z'))

      // Decoded back to exactly what was typed
      expect(deserialized?.searchText).toBe('x + y = z')
    })

    it('should filter out non-numeric problem numbers', () => {
      // A hand-edited list with a word sitting in the middle of it
      const deserialized = deserializeFilters('problemNumbers=1,abc,3')

      // The numbers survive and the word is dropped
      expect(deserialized?.problemNumbers).toEqual([1, 3])
    })

    it('drops an empty problem number rather than reading it as zero', () => {
      // A hand-edited list with a stray comma in it
      const deserialized = deserializeFilters('problemNumbers=1,,2')

      // An empty segment names no position, so it is dropped like the word above
      expect(deserialized?.problemNumbers).toEqual([1, 2])
    })

    it('drops a segment that is a number but not a position', () => {
      // A hand-edited list carrying a fraction, a negative, a zero and an unbounded value
      const deserialized = deserializeFilters('problemNumbers=1,1.5,-2,0,Infinity,3')

      // A position is a whole number counting from one, and the API takes nothing else
      expect(deserialized?.problemNumbers).toEqual([1, 3])
    })

    it('reads a logic mode the filter does not offer as the default', () => {
      // A hand-edited mode for the tags, and another for the authors
      const deserialized = deserializeFilters('tagLogic=whatever&authorLogic=17')

      // Neither names a mode, so both fall back to matching any
      expect(deserialized?.tagLogic).toBe('or')
      expect(deserialized?.authorLogic).toBe('or')
    })

    it('writes the search term without the padding around it', () => {
      // A term the user typed with spaces either side
      const filters = createFilters({ searchText: '  ab  ' })

      // The filters written out
      const serialized = serializeFilters(filters)

      // The padding is not part of the term, so the URL carries only what was searched for
      expect(serialized).toBe('q=ab')
    })
  })
})
