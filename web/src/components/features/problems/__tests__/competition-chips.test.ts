import { describe, expect, it } from 'vitest'

import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { generateCompetitionChips } from '../utils/competition-chips'

// Mock onFiltersChange function for testing
const mockOnFiltersChange = () => {}

describe('Competition Chips Logic', () => {
  // Real data structure from your API with categories
  const mockBaseOptions: FilterOptionsWithCounts = {
    competitions: [
      {
        competitionData: { slug: 'csmo', displayName: 'Matematická Olympiáda', count: 100 },
        categoryData: [
          {
            categoryData: { slug: 'a', displayName: 'A', count: 50 },
            roundData: [
              { slug: 'i', displayName: 'Domáce kolo', count: 25 },
              { slug: 's', displayName: 'Školské kolo', count: 25 },
              { slug: 'ii', displayName: 'Krajské kolo', count: 25 },
              { slug: 'iii', displayName: 'Celoštátne kolo', count: 25 },
            ],
          },
          {
            categoryData: { slug: 'b', displayName: 'B', count: 50 },
            roundData: [
              { slug: 'i', displayName: 'Domáce kolo', count: 25 },
              { slug: 's', displayName: 'Školské kolo', count: 25 },
              { slug: 'ii', displayName: 'Krajské kolo', count: 25 },
            ],
          },
          {
            categoryData: { slug: 'c', displayName: 'C', count: 50 },
            roundData: [
              { slug: 'i', displayName: 'Domáce kolo', count: 25 },
              { slug: 's', displayName: 'Školské kolo', count: 25 },
              { slug: 'ii', displayName: 'Krajské kolo', count: 25 },
            ],
          },
          {
            categoryData: { slug: 'z9', displayName: 'Z9', count: 50 },
            roundData: [
              { slug: 'i', displayName: 'Domáce kolo', count: 25 },
              { slug: 'ii', displayName: 'Okresné kolo', count: 25 },
              { slug: 'iii', displayName: 'Krajské kolo', count: 25 },
            ],
          },
          {
            categoryData: { slug: 'z8', displayName: 'Z8', count: 50 },
            roundData: [
              { slug: 'i', displayName: 'Domáce kolo', count: 25 },
              { slug: 'ii', displayName: 'Okresné kolo', count: 25 },
            ],
          },
        ],
        roundData: [],
      },
      {
        competitionData: { slug: 'tst', displayName: 'Výberové sústredenie', count: 100 },
        categoryData: [],
        roundData: [
          { slug: 'd1', displayName: '1. deň', count: 20 },
          { slug: 'd2', displayName: '2. deň', count: 20 },
          { slug: 'd3', displayName: '3. deň', count: 20 },
          { slug: 'd4', displayName: '4. deň', count: 20 },
          { slug: 'd5', displayName: '5. deň', count: 20 },
        ],
      },
      {
        competitionData: {
          slug: 'memo',
          displayName: 'Middle European Mathematical Olympiad',
          count: 150,
        },
        categoryData: [],
        roundData: [
          { slug: 'i', displayName: 'Individuálna súťaž', count: 75 },
          { slug: 't', displayName: 'Tímová súťaž', count: 75 },
        ],
      },
      {
        competitionData: {
          slug: 'imo',
          displayName: 'International Mathematical Olympiad',
          count: 200,
        },
        categoryData: [],
        roundData: [{ slug: '', displayName: '', count: 0 }], // Empty slug/data as in real API
      },
    ],
    seasons: [],
    problemNumbers: [],
    tags: [],
    authors: [],
  }

  describe('Competition chip generation scenarios', () => {
    it('should show "MO - A - školské kolo" when user selects MO - A - školské kolo', () => {
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 's',
            displayName: 'Matematická Olympiáda - A - Školské kolo',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(1)
      expect(chips[0].displayName).toBe('Matematická Olympiáda - A - Školské kolo')
    })

    it('should show both chips when user selects both školské A and školské B', () => {
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 's',
            displayName: 'Matematická Olympiáda - A - Školské kolo',
          },
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'b',
            roundSlug: 's',
            displayName: 'Matematická Olympiáda - B - Školské kolo',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(2)
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - A - Školské kolo')
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - B - Školské kolo')
    })

    it('should show only "MO" when user selects entire MO competition', () => {
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'competition',
            competitionSlug: 'csmo',
            displayName: 'Matematická Olympiáda',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(1)
      expect(chips[0].displayName).toBe('Matematická Olympiáda')
    })

    it('should show only "MO - A" when user selects entire category A', () => {
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            displayName: 'Matematická Olympiáda - A',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(1)
      expect(chips[0].displayName).toBe('Matematická Olympiáda - A')
    })

    it('should show "MO - A" and "MO - B - školské kolo" when user selects category A + one round from B', () => {
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            displayName: 'Matematická Olympiáda - A',
          },
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'b',
            roundSlug: 's',
            displayName: 'Matematická Olympiáda - B - Školské kolo',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(2)
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - A')
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - B - Školské kolo')
    })

    it('should handle category → individual rounds → category transitions', () => {
      // Step 1: Select entire category A
      const step1Filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            displayName: 'Matematická Olympiáda - A',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const step1Chips = generateCompetitionChips(
        step1Filters,
        mockBaseOptions,
        mockOnFiltersChange
      )
      expect(step1Chips).toHaveLength(1)
      expect(step1Chips[0].displayName).toBe('Matematická Olympiáda - A')

      // Step 2: Unselect one round (školské kolo), should show individual rounds
      const step2Filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 'i',
            displayName: 'Matematická Olympiáda - A - Domáce kolo',
          },
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 'ii',
            displayName: 'Matematická Olympiáda - A - Krajské kolo',
          },
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 'iii',
            displayName: 'Matematická Olympiáda - A - Celoštátne kolo',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const step2Chips = generateCompetitionChips(
        step2Filters,
        mockBaseOptions,
        mockOnFiltersChange
      )
      expect(step2Chips).toHaveLength(3)
      expect(step2Chips.map((c) => c.displayName)).toContain(
        'Matematická Olympiáda - A - Domáce kolo'
      )
      expect(step2Chips.map((c) => c.displayName)).toContain(
        'Matematická Olympiáda - A - Krajské kolo'
      )
      expect(step2Chips.map((c) => c.displayName)).toContain(
        'Matematická Olympiáda - A - Celoštátne kolo'
      )

      // Step 3: Select the missing round back, should compress back to category
      const step3Filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            displayName: 'Matematická Olympiáda - A',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const step3Chips = generateCompetitionChips(
        step3Filters,
        mockBaseOptions,
        mockOnFiltersChange
      )
      expect(step3Chips).toHaveLength(1)
      expect(step3Chips[0].displayName).toBe('Matematická Olympiáda - A')
    })

    it('should handle multi-level compression: all categories → entire competition', () => {
      // Test selecting all categories individually, should compress to entire competition
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          // All categories selected (A, B, C, Z9, Z8, Z7, Z6, Z5, Z4)
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            displayName: 'Matematická Olympiáda - A',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'b',
            displayName: 'Matematická Olympiáda - B',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'c',
            displayName: 'Matematická Olympiáda - C',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'z9',
            displayName: 'Matematická Olympiáda - Z9',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'z8',
            displayName: 'Matematická Olympiáda - Z8',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'z7',
            displayName: 'Matematická Olympiáda - Z7',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'z6',
            displayName: 'Matematická Olympiáda - Z6',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'z5',
            displayName: 'Matematická Olympiáda - Z5',
          },
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'z4',
            displayName: 'Matematická Olympiáda - Z4',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(1)
      expect(chips[0].displayName).toBe('Matematická Olympiáda')
    })

    it('should handle partial multi-level compression: some categories + individual rounds', () => {
      // Test selecting some categories + individual rounds from other categories
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          // Category A fully selected
          {
            type: 'category',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            displayName: 'Matematická Olympiáda - A',
          },
          // Only some rounds from category B
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'b',
            roundSlug: 'i',
            displayName: 'Matematická Olympiáda - B - Domáce kolo',
          },
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'b',
            roundSlug: 's',
            displayName: 'Matematická Olympiáda - B - Školské kolo',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(3)
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - A')
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - B - Domáce kolo')
      expect(chips.map((c) => c.displayName)).toContain('Matematická Olympiáda - B - Školské kolo')
    })

    it('should handle competitions with direct rounds (no categories)', () => {
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          {
            type: 'round',
            competitionSlug: 'memo',
            roundSlug: 't',
            displayName: 'Middle European Mathematical Olympiad - Tímová súťaž',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      expect(chips).toHaveLength(1)
      expect(chips[0].displayName).toBe('Middle European Mathematical Olympiad - Tímová súťaž')
    })

    it('should order chips according to tree hierarchy', () => {
      // Create selections in reverse order to test that chips appear in tree order
      const filters: SearchFiltersState = {
        searchText: '',
        searchInSolution: false,
        seasons: [],
        contestSelection: [
          // Select CSMO Final first (should appear second in chips - after CSMO)
          {
            type: 'round',
            competitionSlug: 'tst',
            roundSlug: 'd5',
            displayName: 'Výberové sústredenie - 5. deň',
          },
          // Select IMO Senior Round 2 second (should appear third in chips)
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'b',
            roundSlug: 'ii',
            displayName: 'Matematická Olympiáda - B - Krajské kolo',
          },
          // Select IMO Senior Round 1 third (should appear second in chips)
          {
            type: 'round',
            competitionSlug: 'csmo',
            categorySlug: 'a',
            roundSlug: 'i',
            displayName: 'Matematická Olympiáda - A - Domáce kolo',
          },
        ],
        problemNumbers: [],
        tags: [],
        tagLogic: 'and',
        authors: [],
        authorLogic: 'and',
      }

      const chips = generateCompetitionChips(filters, mockBaseOptions, mockOnFiltersChange)

      // Verify the order matches the tree structure:
      // 1. CSMO A Domáce kolo (first in CSMO tree)
      // 2. CSMO B Krajské kolo (second in CSMO tree)
      // 3. TST 5. deň (first in TST tree)
      expect(chips).toHaveLength(3)
      expect(chips[0].displayName).toBe('Matematická Olympiáda - A - Domáce kolo')
      expect(chips[1].displayName).toBe('Matematická Olympiáda - B - Krajské kolo')
      expect(chips[2].displayName).toBe('Výberové sústredenie - 5. deň')
    })
  })
})
