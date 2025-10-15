import { describe, expect, it } from 'vitest'

import type { CompetitionFilterOption } from '../types/problem-api-types'
import { interpretSelectionParts } from '../utils/selection-interpreter'

const mockCompetitionsTree: CompetitionFilterOption[] = [
  {
    competitionData: { slug: 'csmo', displayName: 'Matematická Olympiáda', count: 100 },
    categoryData: [
      {
        categoryData: { slug: 'a', displayName: 'Kategória A', count: 50 },
        roundData: [
          { slug: 'i', displayName: 'Domáce kolo', count: 25 },
          { slug: 's', displayName: 'Školské kolo', count: 25 },
        ],
      },
    ],
    roundData: [],
  },
  {
    competitionData: { slug: 'cpsj', displayName: 'CPSJ', count: 20 },
    categoryData: [],
    roundData: [
      { slug: 'i', displayName: 'Individuálna súťaž', count: 10 },
      { slug: 't', displayName: 'Tímová súťaž', count: 10 },
    ],
  },
  {
    competitionData: { slug: 'imo', displayName: 'IMO', count: 50 },
    categoryData: [],
    roundData: [],
  },
]

describe('Selection Interpreter', () => {
  it('should interpret single parts as competitions', () => {
    const parts = [['imo']]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toEqual([{ type: 'competition', competitionSlug: 'imo', displayName: 'IMO' }])
  })

  it('should interpret two parts as a category when it exists', () => {
    const parts = [['csmo', 'a']]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toEqual([
      {
        type: 'category',
        competitionSlug: 'csmo',
        categorySlug: 'a',
        displayName: 'Matematická Olympiáda - Kategória A',
      },
    ])
  })

  it('should interpret two parts as a direct round when no category exists', () => {
    const parts = [['cpsj', 'i']]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toEqual([
      {
        type: 'round',
        competitionSlug: 'cpsj',
        roundSlug: 'i',
        displayName: 'CPSJ - Individuálna súťaž',
      },
    ])
  })

  it('should interpret three parts as a round within a category', () => {
    const parts = [['csmo', 'a', 'i']]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toEqual([
      {
        type: 'round',
        competitionSlug: 'csmo',
        categorySlug: 'a',
        roundSlug: 'i',
        displayName: 'Matematická Olympiáda - Kategória A - Domáce kolo',
      },
    ])
  })

  it('should handle a mix of different selection types', () => {
    const parts = [
      ['imo'], // competition
      ['csmo', 'a'], // category
      ['cpsj', 't'], // direct round
      ['csmo', 'a', 's'], // round with category
    ]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toEqual([
      { type: 'competition', competitionSlug: 'imo', displayName: 'IMO' },
      {
        type: 'category',
        competitionSlug: 'csmo',
        categorySlug: 'a',
        displayName: 'Matematická Olympiáda - Kategória A',
      },
      {
        type: 'round',
        competitionSlug: 'cpsj',
        roundSlug: 't',
        displayName: 'CPSJ - Tímová súťaž',
      },
      {
        type: 'round',
        competitionSlug: 'csmo',
        categorySlug: 'a',
        roundSlug: 's',
        displayName: 'Matematická Olympiáda - Kategória A - Školské kolo',
      },
    ])
  })

  it('should handle invalid competition slugs gracefully', () => {
    const parts = [['nonexistent', 'a']]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toEqual([])
  })

  it('should return null if any selection part is invalid', () => {
    // csmo-x is an invalid category
    const parts = [
      ['csmo', 'a'],
      ['csmo', 'x'],
    ]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toBeNull()
  })

  it('should return null for invalid round in a valid category', () => {
    // csmo-a-x is an invalid round
    const parts = [['csmo', 'a', 'x']]
    const result = interpretSelectionParts(parts, mockCompetitionsTree)
    expect(result).toBeNull()
  })
})
