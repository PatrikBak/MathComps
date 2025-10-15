import { describe, expect, it } from 'vitest'

import type { CategoryFilterOption, FacetOption } from '../types/problem-api-types'
import type { ContestSelection, FilterOptionsWithCounts } from '../types/problem-library-types'
import {
  needsLabelResolution,
  resolveContestSelectionLabels,
} from '../utils/contest-selection-resolver'

describe('Contest Selection Resolver', () => {
  const mockFilterOptions: FilterOptionsWithCounts = {
    competitions: [
      {
        competitionData: {
          slug: 'csmo',
          displayName: 'Česko-Slovenská Matematická Olympiáda',
          count: 100,
        },
        categoryData: [
          {
            categoryData: {
              slug: 'a',
              displayName: 'Kategória A',
              count: 50,
            },
            roundData: [
              {
                slug: 'i',
                displayName: 'I. kolo',
                count: 25,
              },
              {
                slug: 'ii',
                displayName: 'II. kolo',
                count: 15,
              },
            ],
          },
          {
            categoryData: {
              slug: 'b',
              displayName: 'Kategória B',
              count: 30,
            },
            roundData: [
              {
                slug: 's',
                displayName: 'Súťažné kolo',
                count: 20,
              },
            ],
          },
        ],
        roundData: [
          {
            slug: 'district',
            displayName: 'Okresné kolo',
            count: 40,
          },
        ],
      },
      {
        competitionData: {
          slug: 'imo',
          displayName: 'International Mathematical Olympiad',
          count: 50,
        },
        categoryData: [],
        roundData: [
          {
            slug: 'final',
            displayName: 'Final Round',
            count: 25,
          },
        ],
      },
    ],
    seasons: [],
    problemNumbers: [],
    tags: [],
    authors: [],
  }

  describe('resolveContestSelectionLabels', () => {
    it('should resolve competition-only selection labels', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'csmo',
        },
        {
          type: 'competition',
          competitionSlug: 'imo',
          displayName: 'imo',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(2)
      expect(resolved[0].displayName).toBe('Česko-Slovenská Matematická Olympiáda')
      expect(resolved[1].displayName).toBe('International Mathematical Olympiad')
    })

    it('should resolve category selection labels', () => {
      const selections: ContestSelection[] = [
        {
          type: 'category',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          displayName: 'csmo - a',
        },
        {
          type: 'category',
          competitionSlug: 'csmo',
          categorySlug: 'b',
          displayName: 'csmo - b',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(2)
      expect(resolved[0].displayName).toBe('Česko-Slovenská Matematická Olympiáda - Kategória A')
      expect(resolved[1].displayName).toBe('Česko-Slovenská Matematická Olympiáda - Kategória B')
    })

    it('should resolve round selection labels within categories', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'i',
          displayName: 'csmo - a - i',
        },
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'b',
          roundSlug: 's',
          displayName: 'csmo - b - s',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(2)
      expect(resolved[0].displayName).toBe(
        'Česko-Slovenská Matematická Olympiáda - Kategória A - I. kolo'
      )
      expect(resolved[1].displayName).toBe(
        'Česko-Slovenská Matematická Olympiáda - Kategória B - Súťažné kolo'
      )
    })

    it('should resolve direct round selection labels (no category)', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          roundSlug: 'district',
          displayName: 'csmo - district',
        },
        {
          type: 'round',
          competitionSlug: 'imo',
          roundSlug: 'final',
          displayName: 'imo - final',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(2)
      expect(resolved[0].displayName).toBe('Česko-Slovenská Matematická Olympiáda - Okresné kolo')
      expect(resolved[1].displayName).toBe('International Mathematical Olympiad - Final Round')
    })

    it('should handle missing competition data gracefully', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'unknown-comp',
          displayName: 'unknown-comp',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(1)
      expect(resolved[0].displayName).toBe('unknown-comp') // Keep original label
    })

    it('should handle missing category data gracefully', () => {
      const selections: ContestSelection[] = [
        {
          type: 'category',
          competitionSlug: 'csmo',
          categorySlug: 'unknown-category',
          displayName: 'csmo - unknown-category',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(1)
      expect(resolved[0].displayName).toBe(
        'Česko-Slovenská Matematická Olympiáda - unknown-category'
      )
    })

    it('should handle missing round data gracefully', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'unknown-round',
          displayName: 'csmo - a - unknown-round',
        },
        {
          type: 'round',
          competitionSlug: 'csmo',
          roundSlug: 'unknown-direct-round',
          displayName: 'csmo - unknown-direct-round',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(2)
      expect(resolved[0].displayName).toBe(
        'Česko-Slovenská Matematická Olympiáda - Kategória A - unknown-round'
      )
      expect(resolved[1].displayName).toBe(
        'Česko-Slovenská Matematická Olympiáda - unknown-direct-round'
      )
    })

    it('should handle null filterOptions gracefully', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'csmo',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, null)

      expect(resolved).toHaveLength(1)
      expect(resolved[0].displayName).toBe('csmo') // Keep original label
    })

    it('should handle empty selections array', () => {
      const resolved = resolveContestSelectionLabels([], mockFilterOptions)

      expect(resolved).toEqual([])
    })

    it('should preserve all other properties of ContestSelection', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'i',
          displayName: 'csmo - a - i',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved[0]).toEqual({
        type: 'round',
        competitionSlug: 'csmo',
        categorySlug: 'a',
        roundSlug: 'i',
        displayName: 'Česko-Slovenská Matematická Olympiáda - Kategória A - I. kolo',
      })
    })

    it('should handle mixed scenarios with some resolvable and some not', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'csmo',
        },
        {
          type: 'competition',
          competitionSlug: 'unknown',
          displayName: 'unknown',
        },
        {
          type: 'category',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          displayName: 'csmo - a',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved).toHaveLength(3)
      expect(resolved[0].displayName).toBe('Česko-Slovenská Matematická Olympiáda')
      expect(resolved[1].displayName).toBe('unknown') // Keep original
      expect(resolved[2].displayName).toBe('Česko-Slovenská Matematická Olympiáda - Kategória A')
    })
  })

  describe('needsLabelResolution', () => {
    it('should return true for slug-based labels that can be resolved', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'csmo', // Slug-based label
        },
      ]

      const result = needsLabelResolution(selections, mockFilterOptions)

      expect(result).toBe(true)
    })

    it('should return true for complex slug-based labels', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'i',
          displayName: 'csmo - a - i', // Slug-based label
        },
      ]

      const result = needsLabelResolution(selections, mockFilterOptions)

      expect(result).toBe(true)
    })

    it('should return false for already resolved labels', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'Česko-Slovenská Matematická Olympiáda', // Already resolved
        },
      ]

      const result = needsLabelResolution(selections, mockFilterOptions)

      expect(result).toBe(false)
    })

    it('should return false when filterOptions is null', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'csmo',
        },
      ]

      const result = needsLabelResolution(selections, null)

      expect(result).toBe(false)
    })

    it('should return false for empty selections', () => {
      const result = needsLabelResolution([], mockFilterOptions)

      expect(result).toBe(false)
    })

    it('should return false when competition data is not available', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'unknown-comp',
          displayName: 'unknown-comp',
        },
      ]

      const result = needsLabelResolution(selections, mockFilterOptions)

      expect(result).toBe(false)
    })

    it('should return true when at least one selection needs resolution', () => {
      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'Česko-Slovenská Matematická Olympiáda', // Already resolved
        },
        {
          type: 'competition',
          competitionSlug: 'imo',
          displayName: 'imo', // Needs resolution
        },
      ]

      const result = needsLabelResolution(selections, mockFilterOptions)

      expect(result).toBe(true)
    })

    it('should handle edge cases with partial slug matches', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'i',
          displayName: 'Some Custom Label - csmo', // Contains slug but not slug-based
        },
      ]

      const result = needsLabelResolution(selections, mockFilterOptions)

      expect(result).toBe(false) // Not a pure slug-based label
    })
  })

  describe('Complex Resolution Scenarios', () => {
    it('should handle competition tree with deep nesting and missing data', () => {
      const complexFilterOptions: FilterOptionsWithCounts = {
        competitions: [
          {
            competitionData: { slug: 'mo', displayName: 'Mathematical Olympiad', count: 200 },
            categoryData: [
              {
                categoryData: { slug: 'junior', displayName: 'Junior Category', count: 100 },
                roundData: [
                  { slug: 'regional', displayName: 'Regional Round', count: 50 },
                  { slug: 'national', displayName: 'National Round', count: 30 },
                ],
              },
              {
                categoryData: { slug: 'senior', displayName: 'Senior Category', count: 100 },
                roundData: [], // No rounds in this category
              },
            ],
            roundData: [{ slug: 'practice', displayName: 'Practice Round', count: 20 }],
          },
        ],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      }

      const complexSelections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'mo',
          categorySlug: 'junior',
          roundSlug: 'regional',
          displayName: 'mo - junior - regional',
        },
        {
          type: 'round',
          competitionSlug: 'mo',
          categorySlug: 'senior',
          roundSlug: 'nonexistent',
          displayName: 'mo - senior - nonexistent',
        },
        {
          type: 'round',
          competitionSlug: 'mo',
          roundSlug: 'practice',
          displayName: 'mo - practice',
        },
        {
          type: 'category',
          competitionSlug: 'mo',
          categorySlug: 'nonexistent',
          displayName: 'mo - nonexistent',
        },
      ]

      const resolved = resolveContestSelectionLabels(complexSelections, complexFilterOptions)

      expect(resolved[0].displayName).toBe(
        'Mathematical Olympiad - Junior Category - Regional Round'
      )
      expect(resolved[1].displayName).toBe('Mathematical Olympiad - Senior Category - nonexistent') // Round not found
      expect(resolved[2].displayName).toBe('Mathematical Olympiad - Practice Round') // Direct round
      expect(resolved[3].displayName).toBe('Mathematical Olympiad - nonexistent') // Category not found
    })

    it('should prioritize exact matches over partial matches', () => {
      const conflictingOptions: FilterOptionsWithCounts = {
        competitions: [
          {
            competitionData: { slug: 'test', displayName: 'Test Competition', count: 50 },
            categoryData: [
              { categoryData: { slug: 'a', displayName: 'Category A', count: 25 }, roundData: [] },
              {
                categoryData: { slug: 'aa', displayName: 'Category AA', count: 25 },
                roundData: [],
              },
            ],
            roundData: [],
          },
        ],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      }

      const selections: ContestSelection[] = [
        { type: 'category', competitionSlug: 'test', categorySlug: 'a', displayName: 'test - a' },
        { type: 'category', competitionSlug: 'test', categorySlug: 'aa', displayName: 'test - aa' },
      ]

      const resolved = resolveContestSelectionLabels(selections, conflictingOptions)

      expect(resolved[0].displayName).toBe('Test Competition - Category A')
      expect(resolved[1].displayName).toBe('Test Competition - Category AA')
    })

    it('should handle circular or malformed data structures gracefully', () => {
      const malformedOptions = {
        competitions: [
          {
            competitionData: { slug: 'broken', displayName: 'Broken Competition', count: 10 },
            categoryData: null as unknown as CategoryFilterOption[], // Simulate malformed data
            roundData: undefined as unknown as FacetOption[], // Simulate malformed data
          },
        ],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      } as FilterOptionsWithCounts

      const selections: ContestSelection[] = [
        {
          type: 'category',
          competitionSlug: 'broken',
          categorySlug: 'any',
          displayName: 'broken - any',
        },
        { type: 'round', competitionSlug: 'broken', roundSlug: 'any', displayName: 'broken - any' },
      ]

      const resolved = resolveContestSelectionLabels(selections, malformedOptions)

      expect(resolved[0].displayName).toBe('Broken Competition - any') // Fallback handling
      expect(resolved[1].displayName).toBe('Broken Competition - any') // Fallback handling
    })
  })

  describe('Performance and Optimization Tests', () => {
    it('should handle large datasets efficiently', () => {
      const largeOptions: FilterOptionsWithCounts = {
        competitions: Array.from({ length: 100 }, (_, i) => ({
          competitionData: { slug: `comp-${i}`, displayName: `Competition ${i}`, count: 100 },
          categoryData: Array.from({ length: 10 }, (_, j) => ({
            categoryData: { slug: `cat-${j}`, displayName: `Category ${j}`, count: 10 },
            roundData: Array.from({ length: 5 }, (_, k) => ({
              slug: `round-${k}`,
              displayName: `Round ${k}`,
              count: 2,
            })),
          })),
          roundData: [],
        })),
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      }

      const largeSelectionSet: ContestSelection[] = Array.from({ length: 1000 }, (_, i) => ({
        type: 'round' as const,
        competitionSlug: `comp-${i % 100}`,
        categorySlug: `cat-${i % 10}`,
        roundSlug: `round-${i % 5}`,
        displayName: `comp-${i % 100} - cat-${i % 10} - round-${i % 5}`,
      }))

      const startTime = performance.now()
      const resolved = resolveContestSelectionLabels(largeSelectionSet, largeOptions)
      const endTime = performance.now()

      expect(resolved).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
      expect(resolved[0].displayName).toBe('Competition 0 - Category 0 - Round 0')
      expect(resolved[999].displayName).toBe('Competition 99 - Category 9 - Round 4')
    })

    it('should not modify original selection objects', () => {
      const originalSelections: ContestSelection[] = [
        { type: 'competition', competitionSlug: 'csmo', displayName: 'original-label' },
      ]

      const originalLabel = originalSelections[0].displayName
      const resolved = resolveContestSelectionLabels(originalSelections, mockFilterOptions)

      expect(originalSelections[0].displayName).toBe(originalLabel) // Original unchanged
      expect(resolved[0].displayName).not.toBe(originalLabel) // Result is different
      expect(resolved[0]).not.toBe(originalSelections[0]) // Different object reference
    })
  })

  describe('needsLabelResolution Advanced Logic', () => {
    it('should detect subtle differences between slug-based and resolved labels', () => {
      const subtleSelections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'Česko-Slovenská Matematická Olympiáda',
        }, // Already resolved
        { type: 'competition', competitionSlug: 'imo', displayName: 'imo' }, // Needs resolution
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          roundSlug: 'i',
          displayName: 'Custom Label for CSMO',
        }, // Custom label
      ]

      const needsResolution = needsLabelResolution(subtleSelections, mockFilterOptions)

      expect(needsResolution).toBe(true) // Because 'imo' label needs resolution
    })

    it('should handle mixed resolved and unresolved states correctly', () => {
      const mixedSelections: ContestSelection[] = [
        { type: 'competition', competitionSlug: 'unknown', displayName: 'unknown' }, // Unknown competition
        { type: 'competition', competitionSlug: 'csmo', displayName: 'csmo' }, // Known but unresolved
      ]

      const needsResolution = needsLabelResolution(mixedSelections, mockFilterOptions)

      expect(needsResolution).toBe(true) // Because 'csmo' can be resolved
    })

    it('should return false when all labels are already optimally resolved', () => {
      const fullyResolvedSelections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'Česko-Slovenská Matematická Olympiáda',
        },
        {
          type: 'category',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          displayName: 'Česko-Slovenská Matematická Olympiáda - Kategória A',
        },
      ]

      const needsResolution = needsLabelResolution(fullyResolvedSelections, mockFilterOptions)

      expect(needsResolution).toBe(false)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle filterOptions with empty competitions array', () => {
      const emptyFilterOptions: FilterOptionsWithCounts = {
        competitions: [],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      }

      const selections: ContestSelection[] = [
        {
          type: 'competition',
          competitionSlug: 'csmo',
          displayName: 'csmo',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, emptyFilterOptions)
      const needsResolution = needsLabelResolution(selections, emptyFilterOptions)

      expect(resolved[0].displayName).toBe('csmo') // Keep original
      expect(needsResolution).toBe(false)
    })

    it('should handle selections with undefined categorySlug and roundSlug', () => {
      const selections: ContestSelection[] = [
        {
          type: 'round',
          competitionSlug: 'csmo',
          categorySlug: undefined,
          roundSlug: 'district',
          displayName: 'csmo - district',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, mockFilterOptions)

      expect(resolved[0].displayName).toBe('Česko-Slovenská Matematická Olympiáda - Okresné kolo')
    })

    it('should handle malformed FilterOptions structure', () => {
      const malformedOptions = {
        competitions: [
          {
            competitionData: {
              slug: 'csmo',
              displayName: 'CSMO',
              count: 100,
            },
            categoryData: [],
            roundData: [],
          },
        ],
        seasons: [],
        problemNumbers: [],
        tags: [],
        authors: [],
      } as FilterOptionsWithCounts

      const selections: ContestSelection[] = [
        {
          type: 'category',
          competitionSlug: 'csmo',
          categorySlug: 'a',
          displayName: 'csmo - a',
        },
      ]

      const resolved = resolveContestSelectionLabels(selections, malformedOptions)

      expect(resolved[0].displayName).toBe('CSMO - a') // Fallback to slug
    })
  })
})
