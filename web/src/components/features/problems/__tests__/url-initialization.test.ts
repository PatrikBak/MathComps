import { describe, expect, it } from 'vitest'

import type { CompetitionFilterOption } from '../types/problem-api-types'
import { initializeFiltersFromUrlOrDefaults } from '../utils/url-initialization'

describe('URL Initialization', () => {
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

  it('returns default filters for empty URL', () => {
    const params = new URLSearchParams({})
    const result = initializeFiltersFromUrlOrDefaults(params, mockCompetitionsTree)

    expect(result.hasInvalidParams).toBe(false)
    expect(result.filters.searchText).toBe('')
    expect(result.filters.contestSelection).toEqual([])
  })

  it('parses complex competition hierarchy (competition-category-round)', () => {
    const params = new URLSearchParams({
      q: 'algebra',
      competitions: 'csmo-a-i,imo,memo-i',
    })

    const result = initializeFiltersFromUrlOrDefaults(params, mockCompetitionsTree)

    expect(result.hasInvalidParams).toBe(false)
    expect(result.filters.searchText).toBe('algebra')
    expect(result.filters.contestSelection).toEqual(
      expect.arrayContaining([
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
      ])
    )
  })

  it('rejects invalid competition slugs and returns defaults', () => {
    const params = new URLSearchParams({ competitions: 'csmo-x' }) // 'x' is not a valid category

    const result = initializeFiltersFromUrlOrDefaults(params, mockCompetitionsTree)

    expect(result.hasInvalidParams).toBe(true)
    expect(result.filters.contestSelection).toEqual([])
  })

  it('rejects unknown URL params', () => {
    const params = new URLSearchParams({ unknownParam: 'value' })

    const result = initializeFiltersFromUrlOrDefaults(params, mockCompetitionsTree)

    expect(result.hasInvalidParams).toBe(true)
  })

  it('tracks favoritesRequested for auth redirect', () => {
    const params = new URLSearchParams({ favoritesOnly: 'true' })

    const result = initializeFiltersFromUrlOrDefaults(params, mockCompetitionsTree)

    expect(result.favoritesRequested).toBe(true)
    expect(result.filters.favoritesOnly).toBe(true)
  })
})
