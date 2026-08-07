import { describe, expect, it } from 'vitest'

import { buildSelectionsFromTreeIds } from '../utils/filter-ids'

/**
 * Three competitions shaped differently on purpose: one with categories holding rounds,
 * one with rounds hanging straight off it, and one with nothing under it at all.
 */
const mockBaseOptions = {
  competitions: [
    {
      competitionData: { slug: 'mo', displayName: 'Matematická Olympiáda', count: 100 },
      categoryData: [
        {
          categoryData: { slug: 'a', displayName: 'A', count: 70 },
          roundData: [
            { slug: 'i', displayName: 'Domáce kolo', count: 50 },
            { slug: 'r', displayName: 'Regionálne kolo', count: 30 },
            { slug: 'k', displayName: 'Krajské kolo', count: 20 },
          ],
        },
        {
          categoryData: { slug: 'b', displayName: 'B', count: 65 },
          roundData: [
            { slug: 'i', displayName: 'Domáce kolo', count: 40 },
            { slug: 'r', displayName: 'Regionálne kolo', count: 25 },
          ],
        },
      ],
      roundData: [],
    },
    {
      competitionData: { slug: 'memo', displayName: 'MEMO', count: 35 },
      categoryData: [],
      roundData: [
        { slug: 't', displayName: 'Tímová súťaž', count: 15 },
        { slug: 'i', displayName: 'Individuálna súťaž', count: 20 },
      ],
    },
    {
      competitionData: {
        slug: 'imo',
        displayName: 'International Mathematical Olympiad',
        count: 25,
      },
      categoryData: [],
      roundData: [],
    },
  ],
  seasons: [],
  problemNumbers: [],
  tags: [],
  authors: [],
}

describe('buildSelectionsFromTreeIds', () => {
  describe('folding complete sets up a level', () => {
    it('folds every round of a category into the category', () => {
      // Arrange all three rounds category A holds
      const allRoundsInCategoryA = [
        'competition/mo/category/a/round/i',
        'competition/mo/category/a/round/r',
        'competition/mo/category/a/round/k',
      ]

      // Act on the complete set
      const selections = buildSelectionsFromTreeIds(allRoundsInCategoryA, mockBaseOptions)

      // One entry stands where three were, naming the category
      expect(selections).toEqual([
        {
          type: 'category',
          competitionSlug: 'mo',
          categorySlug: 'a',
          displayName: 'Matematická Olympiáda - A',
        },
      ])
    })

    it('folds every category of a competition into the competition', () => {
      // Arrange both categories the competition holds
      const allCategoriesInMO = ['competition/mo/category/a', 'competition/mo/category/b']

      // Act on the complete set
      const selections = buildSelectionsFromTreeIds(allCategoriesInMO, mockBaseOptions)

      // The competition alone stands for both
      expect(selections).toEqual([
        {
          type: 'competition',
          competitionSlug: 'mo',
          displayName: 'Matematická Olympiáda',
        },
      ])
    })

    it('folds every direct round of a competition into the competition', () => {
      // Arrange both rounds hanging off the competition
      const allDirectRounds = ['competition/memo/round/t', 'competition/memo/round/i']

      // Act on the complete set
      const selections = buildSelectionsFromTreeIds(allDirectRounds, mockBaseOptions)

      // The competition alone stands for both
      expect(selections).toEqual([
        {
          type: 'competition',
          competitionSlug: 'memo',
          displayName: 'MEMO',
        },
      ])
    })

    it('leaves an incomplete set of rounds alone', () => {
      // Arrange two of category A's three rounds, leaving the third out
      const partialRounds = [
        'competition/mo/category/a/round/i',
        'competition/mo/category/a/round/r',
      ]

      // Act on the incomplete set
      const selections = buildSelectionsFromTreeIds(partialRounds, mockBaseOptions)

      // Both survive as rounds, still naming the category they sit under
      expect(selections).toHaveLength(2)
      expect(selections.every((selection) => selection.type === 'round')).toBe(true)
      expect(
        selections.every(
          (selection) => selection.type === 'round' && selection.categorySlug === 'a'
        )
      ).toBe(true)
    })

    it('leaves a competition alone when one of its rounds is picked individually', () => {
      // Arrange one whole category, plus a single round from the other
      const selectedIds = ['competition/mo/category/a', 'competition/mo/category/b/round/i']

      // Act on the mixture
      const selections = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      // Each stays at the level it was picked at
      expect(selections).toHaveLength(2)
      expect(selections[0]).toEqual({
        type: 'category',
        competitionSlug: 'mo',
        categorySlug: 'a',
        displayName: 'Matematická Olympiáda - A',
      })
      expect(selections[1]).toEqual({
        type: 'round',
        competitionSlug: 'mo',
        categorySlug: 'b',
        roundSlug: 'i',
        displayName: 'Matematická Olympiáda - B - Domáce kolo',
      })
    })
  })

  describe('levels the hierarchy does not nest', () => {
    it('keeps a competition that holds neither categories nor rounds', () => {
      // Arrange the one competition with an empty hierarchy
      const selectedIds = ['competition/imo']

      // Act on it
      const selections = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      // It survives untouched, rather than folding into nothing
      expect(selections).toHaveLength(1)
      expect(selections[0]).toEqual({
        type: 'competition',
        competitionSlug: 'imo',
        displayName: 'International Mathematical Olympiad',
      })
    })

    it('keeps a single direct round as a round', () => {
      // Arrange one of the two rounds hanging off the competition
      const selectedIds = ['competition/memo/round/i']

      // Act on it
      const selections = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      // It names its competition and itself, and no category
      expect(selections).toHaveLength(1)
      expect(selections[0]).toEqual({
        type: 'round',
        competitionSlug: 'memo',
        roundSlug: 'i',
        displayName: 'MEMO - Individuálna súťaž',
      })
    })

    it('keeps selections made at different levels of different competitions', () => {
      // Arrange one whole competition, one whole category, and one of two direct rounds
      const selectedIds = [
        'competition/imo',
        'competition/mo/category/a',
        'competition/memo/round/t',
      ]

      // Act on the mixture
      const selections = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      // Each keeps the level it was picked at, and the round names no category
      expect(selections).toEqual([
        {
          type: 'competition',
          competitionSlug: 'imo',
          displayName: 'International Mathematical Olympiad',
        },
        {
          type: 'category',
          competitionSlug: 'mo',
          categorySlug: 'a',
          displayName: 'Matematická Olympiáda - A',
        },
        {
          type: 'round',
          competitionSlug: 'memo',
          categorySlug: undefined,
          roundSlug: 't',
          displayName: 'MEMO - Tímová súťaž',
        },
      ])
    })
  })

  describe('input the hierarchy cannot answer to', () => {
    it('drops the ids it cannot resolve and keeps the rest', () => {
      // Arrange a malformed id, one naming an absent competition, and one good id
      const malformedIds = [
        'invalid/id',
        'competition/nonexistent/category/x',
        'competition/mo/category/a/round/i',
      ]

      // Act on the mixture
      const selections = buildSelectionsFromTreeIds(malformedIds, mockBaseOptions)

      // Only the resolvable one survives
      expect(selections).toHaveLength(1)
      expect(selections[0].type).toBe('round')
      expect(selections[0].competitionSlug).toBe('mo')
    })

    it('yields nothing when the hierarchy is empty', () => {
      // Arrange a hierarchy holding no competitions at all
      const emptyOptions = {
        competitions: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      }

      // Arrange an id nothing can be resolved against
      const validIds = ['comp/mo/cat/a']

      // Act with nothing to resolve against
      const selections = buildSelectionsFromTreeIds(validIds, emptyOptions)

      // An empty result, rather than an error
      expect(selections).toEqual([])
    })

    it('names a round by all three levels above it', () => {
      // Arrange a round sitting under a category
      const roundId = ['competition/mo/category/a/round/i']

      // Act on it
      const selections = buildSelectionsFromTreeIds(roundId, mockBaseOptions)

      // The three names read in order, separated the same way each time
      expect(selections[0].displayName).toBe('Matematická Olympiáda - A - Domáce kolo')
      expect(selections[0].displayName).toMatch(/^[^-]+ - [^-]+ - [^-]+$/)
    })
  })
})
