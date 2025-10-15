import { describe, expect, it } from 'vitest'

import type { SearchFiltersState } from '../../types/problem-library-types'
import { serializeFilters } from '../search-url-serialization'

/**
 * Creates a minimal SearchFiltersState object with only the specified properties
 */
const createTestFilters = (overrides: Partial<SearchFiltersState>): SearchFiltersState => ({
  searchText: '',
  searchInSolution: false,
  seasons: [],
  problemNumbers: [],
  tags: [],
  tagLogic: 'or',
  authors: [],
  authorLogic: 'or',
  contestSelection: [],
  ...overrides,
})

describe('URL Compression for Single Tags and Authors', () => {
  it('should omit tagLogic parameter when only one tag is selected', () => {
    const filters = createTestFilters({
      tags: [{ slug: 'delitelnost', displayName: 'Deliteľnosť' }],
      tagLogic: 'and', // This should be omitted in URL
    })

    const url = serializeFilters(filters)

    expect(url).toBe('tags=delitelnost')
    expect(url).not.toContain('tagLogic')
  })

  it('should include tagLogic parameter when multiple tags are selected with non-default logic', () => {
    const filters = createTestFilters({
      tags: [
        { slug: 'delitelnost', displayName: 'Deliteľnosť' },
        { slug: 'algebra', displayName: 'Algebra' },
      ],
      tagLogic: 'and', // This should be included in URL
    })

    const url = serializeFilters(filters)

    expect(url).toBe('tags=delitelnost,algebra&tagLogic=and')
    expect(url).toContain('tagLogic=and')
  })

  it('should omit tagLogic parameter when multiple tags are selected with default logic', () => {
    const filters = createTestFilters({
      tags: [
        { slug: 'delitelnost', displayName: 'Deliteľnosť' },
        { slug: 'algebra', displayName: 'Algebra' },
      ],
      tagLogic: 'or', // Default logic should be omitted
    })

    const url = serializeFilters(filters)

    expect(url).toBe('tags=delitelnost,algebra')
    expect(url).not.toContain('tagLogic')
  })

  it('should omit authorLogic parameter when only one author is selected', () => {
    const filters = createTestFilters({
      authors: [{ slug: 'john-doe', displayName: 'John Doe' }],
      authorLogic: 'and', // This should be omitted in URL
    })

    const url = serializeFilters(filters)

    expect(url).toBe('authors=john-doe')
    expect(url).not.toContain('authorLogic')
  })

  it('should include authorLogic parameter when multiple authors are selected with non-default logic', () => {
    const filters = createTestFilters({
      authors: [
        { slug: 'john-doe', displayName: 'John Doe' },
        { slug: 'jane-smith', displayName: 'Jane Smith' },
      ],
      authorLogic: 'and', // This should be included in URL
    })

    const url = serializeFilters(filters)

    expect(url).toBe('authors=john-doe,jane-smith&authorLogic=and')
    expect(url).toContain('authorLogic=and')
  })

  it('should omit authorLogic parameter when multiple authors are selected with default logic', () => {
    const filters = createTestFilters({
      authors: [
        { slug: 'john-doe', displayName: 'John Doe' },
        { slug: 'jane-smith', displayName: 'Jane Smith' },
      ],
      authorLogic: 'or', // Default logic should be omitted
    })

    const url = serializeFilters(filters)

    expect(url).toBe('authors=john-doe,jane-smith')
    expect(url).not.toContain('authorLogic')
  })

  it('should handle both single tag and single author compression together', () => {
    const filters = createTestFilters({
      tags: [{ slug: 'delitelnost', displayName: 'Deliteľnosť' }],
      tagLogic: 'and', // Should be omitted
      authors: [{ slug: 'john-doe', displayName: 'John Doe' }],
      authorLogic: 'and', // Should be omitted
    })

    const url = serializeFilters(filters)

    expect(url).toBe('tags=delitelnost&authors=john-doe')
    expect(url).not.toContain('tagLogic')
    expect(url).not.toContain('authorLogic')
  })

  it('should handle mixed scenarios with some compression and some non-compression', () => {
    const filters = createTestFilters({
      tags: [{ slug: 'delitelnost', displayName: 'Deliteľnosť' }],
      tagLogic: 'and', // Should be omitted (single tag)
      authors: [
        { slug: 'john-doe', displayName: 'John Doe' },
        { slug: 'jane-smith', displayName: 'Jane Smith' },
      ],
      authorLogic: 'and', // Should be included (multiple authors)
    })

    const url = serializeFilters(filters)

    expect(url).toBe('tags=delitelnost&authors=john-doe,jane-smith&authorLogic=and')
    expect(url).not.toContain('tagLogic')
    expect(url).toContain('authorLogic=and')
  })
})
