import { describe, expect, it } from 'vitest'

import { buildSelectionsFromTreeIds } from '../utils/filter-ids'

describe('Filter Selection Compression Logic', () => {
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

  describe('Multi-Level Hierarchical Compression Logic', () => {
    it('should compress individual rounds to category when all child rounds are selected', () => {
      // Core compression logic: individual selections → category when complete
      const allRoundsInCategoryA = [
        'competition/mo/category/a/round/i',
        'competition/mo/category/a/round/r',
        'competition/mo/category/a/round/k',
      ]
      const { selections } = buildSelectionsFromTreeIds(allRoundsInCategoryA, mockBaseOptions)

      expect(selections).toEqual([
        {
          type: 'category',
          competitionSlug: 'mo',
          categorySlug: 'a',
          displayName: 'Matematická Olympiáda - A',
        },
      ])
    })

    it('should compress categories to competition when all child categories are selected', () => {
      // Multi-level compression: categories → competition when complete
      const allCategoriesInMO = ['competition/mo/category/a', 'competition/mo/category/b']
      const { selections } = buildSelectionsFromTreeIds(allCategoriesInMO, mockBaseOptions)

      expect(selections).toEqual([
        {
          type: 'competition',
          competitionSlug: 'mo',
          displayName: 'Matematická Olympiáda',
        },
      ])
    })

    it('should compress direct rounds to competition when all direct rounds selected', () => {
      // Special case: competitions with no categories (direct rounds)
      const allDirectRounds = ['competition/memo/round/t', 'competition/memo/round/i']
      const { selections } = buildSelectionsFromTreeIds(allDirectRounds, mockBaseOptions)

      expect(selections).toEqual([
        {
          type: 'competition',
          competitionSlug: 'memo',
          displayName: 'MEMO',
        },
      ])
    })

    it('should not compress when selections are incomplete', () => {
      // Partial selections should remain granular
      const partialRounds = [
        'competition/mo/category/a/round/i',
        'competition/mo/category/a/round/r',
      ] // Missing 'k'
      const { selections } = buildSelectionsFromTreeIds(partialRounds, mockBaseOptions)

      expect(selections).toHaveLength(2)
      expect(selections.every((s) => s.type === 'round')).toBe(true)
      expect(selections.every((s) => s.categorySlug === 'a')).toBe(true)
    })

    it('should handle complex mixed hierarchies with optimal compression', () => {
      // Real-world scenario: mixed explicit and derived selections
      const mixedSelections = [
        'competition/imo', // Explicit competition (leaf - no children)
        'competition/mo/category/a', // Explicit category
        'competition/memo/round/t', // Partial direct round selection
      ]
      const { selections } = buildSelectionsFromTreeIds(mixedSelections, mockBaseOptions)

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

  describe('Leaf Competitions and Direct Rounds', () => {
    it('should handle competitions with empty round data (IMO-style)', () => {
      const selectedIds = ['competition/imo']
      const { selections } = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      expect(selections).toHaveLength(1)
      expect(selections[0]).toEqual({
        type: 'competition',
        competitionSlug: 'imo',
        displayName: 'International Mathematical Olympiad',
      })
    })

    it('should handle partial selection from direct rounds', () => {
      const selectedIds = ['competition/memo/round/i']
      const { selections } = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      expect(selections).toHaveLength(1)
      expect(selections[0]).toEqual({
        type: 'round',
        competitionSlug: 'memo',
        roundSlug: 'i',
        displayName: 'MEMO - Individuálna súťaž',
      })
    })
  })

  describe('Mixed Selection Types and Edge Cases', () => {
    it('should handle mixed selection types correctly', () => {
      const selectedIds = [
        'competition/imo', // Whole competition
        'competition/mo/category/a', // Whole category
        'competition/memo/round/i', // Individual round
      ]
      const { selections } = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      expect(selections).toHaveLength(3)
      expect(selections.map((s) => s.type)).toEqual(['competition', 'category', 'round'])
    })

    it('should not compress if some individual rounds are selected alongside categories', () => {
      const selectedIds = [
        'competition/mo/category/a',
        'competition/mo/category/b/round/i', // Individual round from category B
      ]
      const { selections } = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

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

  describe('Tree Component Parent State Detection', () => {
    it('should detect when all categories are selected (tree UI issue)', () => {
      // This simulates the problematic case: user manually selects all categories
      const selectedIds = [
        'competition/mo/category/a', // Category A selected
        'competition/mo/category/b', // Category B selected
        // Competition parent should be considered "checked" but tree shows indeterminate
      ]

      const { selections } = buildSelectionsFromTreeIds(selectedIds, mockBaseOptions)

      // Our logic correctly compresses to competition level
      expect(selections).toHaveLength(1)
      expect(selections[0].type).toBe('competition')

      // But the tree component doesn't know this because it only looks at descendant rounds,
      // not direct category children in the selected array
    })
  })

  describe('Complex Edge Cases and Data Integrity', () => {
    it('should handle malformed inputs gracefully', () => {
      const malformedIds = [
        'invalid/id',
        'competition/nonexistent/category/x',
        'competition/mo/category/a/round/i',
      ]
      const { selections } = buildSelectionsFromTreeIds(malformedIds, mockBaseOptions)

      // Should process valid IDs and ignore invalid ones
      expect(selections).toHaveLength(1)
      expect(selections[0].type).toBe('round')
      expect(selections[0].competitionSlug).toBe('mo')
    })

    it('should maintain data consistency with empty or invalid base options', () => {
      const emptyOptions = {
        competitions: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      }
      const validIds = ['comp/mo/cat/a']
      const { selections } = buildSelectionsFromTreeIds(validIds, emptyOptions)

      expect(selections).toEqual([]) // Should handle gracefully
    })

    it('should preserve label construction with complex competition data', () => {
      // Verify label building logic works correctly with special characters
      const roundId = ['competition/mo/category/a/round/i']
      const { selections } = buildSelectionsFromTreeIds(roundId, mockBaseOptions)

      expect(selections[0].displayName).toBe('Matematická Olympiáda - A - Domáce kolo')
      expect(selections[0].displayName).toMatch(/^[^-]+ - [^-]+ - [^-]+$/) // Proper format
    })
  })
})
