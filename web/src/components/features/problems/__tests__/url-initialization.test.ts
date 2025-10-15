import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CompetitionFilterOption } from '../types/problem-api-types'
import type { SearchFiltersState } from '../types/problem-library-types'
import { createDefaultFilters, initializeFiltersFromUrl } from '../utils/url-initialization'

describe('URL Initialization', () => {
  const mockOnFiltersChange = vi.fn()

  const createMockSearchParams = (params: Record<string, string>) => {
    return new URLSearchParams(params)
  }

  const mockCompetitionsTree: CompetitionFilterOption[] = [
    {
      competitionData: { displayName: 'IMO', slug: 'imo', count: 100 },
      categoryData: [],
      roundData: [],
    },
    {
      competitionData: { displayName: 'CSMO', slug: 'csmo', count: 200 },
      categoryData: [
        {
          categoryData: { displayName: 'Category A', slug: 'a', count: 100 },
          roundData: [{ displayName: 'Round I', slug: 'i', count: 50 }],
        },
        {
          categoryData: { displayName: 'Category B', slug: 'b', count: 100 },
          roundData: [{ displayName: 'Round S', slug: 's', count: 50 }],
        },
      ],
      roundData: [],
    },
    {
      competitionData: { displayName: 'MEMO', slug: 'memo', count: 150 },
      categoryData: [],
      roundData: [{ displayName: 'Round I', slug: 'i', count: 75 }],
    },
  ]

  const mockCurrentFilters = createDefaultFilters()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should correctly parse, interpret, and apply a complex URL', () => {
    const searchParams = createMockSearchParams({
      q: 'algebra',
      competitions: 'csmo-a-i,imo,memo-i',
    })

    const result = initializeFiltersFromUrl({
      searchParams,
      currentFilters: mockCurrentFilters,
      competitionsTree: mockCompetitionsTree,
      onFiltersChange: mockOnFiltersChange,
    })

    expect(result.hasInvalidParams).toBe(false)
    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        searchText: 'algebra',
        contestSelection: expect.arrayContaining([
          expect.objectContaining({
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 'i',
            displayName: 'CSMO - Category A - Round I',
          }),
          expect.objectContaining({
            type: 'competition',
            competitionSlug: 'imo',
            displayName: 'IMO',
          }),
          expect.objectContaining({
            type: 'round',
            competitionSlug: 'memo',
            roundSlug: 'i',
            displayName: 'MEMO - Round I',
          }),
        ]),
      })
    )
  })

  it('should return hasInvalidParams for invalid competition slugs', () => {
    const searchParams = createMockSearchParams({ competitions: 'csmo-x' }) // 'x' is invalid
    const result = initializeFiltersFromUrl({
      searchParams,
      currentFilters: mockCurrentFilters,
      competitionsTree: mockCompetitionsTree,
      onFiltersChange: mockOnFiltersChange,
    })

    expect(result.hasInvalidParams).toBe(true)
    expect(mockOnFiltersChange).not.toHaveBeenCalled()
  })

  it('should not apply filters if they are identical to the current state', () => {
    const searchParams = createMockSearchParams({ q: 'test' })
    const currentFilters: SearchFiltersState = {
      ...createDefaultFilters(),
      searchText: 'test',
    }
    const result = initializeFiltersFromUrl({
      searchParams,
      currentFilters,
      competitionsTree: mockCompetitionsTree,
      onFiltersChange: mockOnFiltersChange,
    })

    expect(result.hasInvalidParams).toBe(false)
    expect(mockOnFiltersChange).not.toHaveBeenCalled()
  })
})
