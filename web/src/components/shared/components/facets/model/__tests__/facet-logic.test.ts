import { describe, expect, it } from 'vitest'

import {
  compareFacetOptions,
  facetOptionAccessibleName,
  filterOptionsBySearch,
  groupOptionsByKey,
  orderFlatOptions,
  orderGroupedOptions,
  toVisibleSections,
} from '../facet-logic'
import type { FacetGrouping, FacetOption, FacetSortMode } from '../facet-types'

/** Slovak tag names, whose diacritics are the point of the search behaviour. */
const accentedOptions: FacetOption[] = [
  { id: '1', displayName: 'Čísla', count: 10 },
  { id: '2', displayName: 'Rovnice', count: 15 },
  { id: '3', displayName: 'Štatistika', count: 8 },
  { id: '4', displayName: 'Trigonometria', count: 12 },
  { id: '5', displayName: 'Štvorec', count: 5 },
  { id: '6', displayName: 'Čiara', count: 3 },
]

/**
 * Runs a search and reports which options survived it.
 *
 * @param searchTerm - What the user typed.
 * @returns The ids of the matching options.
 */
function matchedIds(searchTerm: string): string[] {
  return filterOptionsBySearch(accentedOptions, searchTerm).map((option) => option.id)
}

describe('facet-logic', () => {
  describe('facetOptionAccessibleName', () => {
    it('reads the count out after the name', () => {
      // Act on an option carrying a count
      const result = facetOptionAccessibleName('Algebra', 42)

      // The figure trails the name in brackets
      expect(result).toBe('Algebra (42)')
    })

    it('names an option by its label alone when the facet shows no counts', () => {
      // Act on an option with no count to fold in
      const result = facetOptionAccessibleName('Algebra', undefined)

      // Nothing is appended, rather than an empty pair of brackets
      expect(result).toBe('Algebra')
    })

    it('keeps a zero count, which is a meaningful figure to read out', () => {
      // Act on the falsy count a naive check would drop
      const result = facetOptionAccessibleName('Algebra', 0)

      // Zero results is worth announcing, so it survives
      expect(result).toBe('Algebra (0)')
    })
  })

  describe('filterOptionsBySearch', () => {
    it('returns every option for an empty term', () => {
      // Act on an empty term
      const result = filterOptionsBySearch(accentedOptions, '')

      // The full list comes back untouched
      expect(result).toEqual(accentedOptions)
    })

    it('ignores case', () => {
      // Act on the word in lowercase
      const lowercase = matchedIds('rovnice')

      // Act on the same word in uppercase
      const uppercase = matchedIds('ROVNICE')

      // Both find the one option, so casing carried no meaning
      expect(lowercase).toEqual(['2'])
      expect(uppercase).toEqual(['2'])
    })

    it('ignores diacritics', () => {
      // Act on three accented names spelled without their accents
      expect(matchedIds('cisla')).toEqual(['1'])
      expect(matchedIds('statistika')).toEqual(['3'])
      expect(matchedIds('ciara')).toEqual(['6'])
    })

    it('ignores case and diacritics at once', () => {
      // Act on terms that are both miscased and unaccented
      expect(matchedIds('CISLA')).toEqual(['1'])
      expect(matchedIds('StAtIsTiKa')).toEqual(['3'])
    })

    it('matches on a prefix of the name, accented or not', () => {
      // Act on a partial word with and without its diacritics
      expect(matchedIds('Štvo')).toEqual(['5'])
      expect(matchedIds('stvo')).toEqual(['5'])
    })

    it('returns every option a term matches', () => {
      // Act on a fragment shared by two names
      const result = matchedIds('st')

      // Both Štatistika and Štvorec survive
      expect(result).toContain('3')
      expect(result).toContain('5')
    })

    it('returns nothing when a term matches no option', () => {
      // Act on a term no name contains
      const result = matchedIds('xyz')

      // Nothing survives, rather than the filter giving up and passing everything
      expect(result).toEqual([])
    })
  })

  describe('compareFacetOptions', () => {
    /**
     * Sorts a copy of the options under one mode, and reports the resulting names.
     *
     * @param options - The options to order.
     * @param sortMode - The ordering to apply.
     * @returns The display names, in the order the mode produced.
     */
    function sortedNames(options: FacetOption[], sortMode: FacetSortMode): string[] {
      return [...options]
        .sort((first, second) => compareFacetOptions(first, second, sortMode, 'sk'))
        .map((option) => option.displayName)
    }

    // Alfa and Beta tie on count, which is what exercises the tiebreak
    const options: FacetOption[] = [
      { id: 'b', displayName: 'Beta', count: 5 },
      { id: 'a', displayName: 'Alfa', count: 5 },
      { id: 'c', displayName: 'Cyklus', count: 20 },
      { id: 'd', displayName: 'Delta', count: 1 },
    ]

    it('orders by display name under the alphabetical mode', () => {
      // Act on the alphabetical mode
      const result = sortedNames(options, 'alpha')

      // Names come out collated, with the largest count taking no precedence
      expect(result).toEqual(['Alfa', 'Beta', 'Cyklus', 'Delta'])
    })

    it('orders by descending count, breaking ties on the name', () => {
      // Act on the descending mode
      const result = sortedNames(options, 'count-desc')

      // The two fives land alphabetically between the twenty and the one
      expect(result).toEqual(['Cyklus', 'Alfa', 'Beta', 'Delta'])
    })

    it('orders by ascending count, breaking ties on the name', () => {
      // Act on the ascending mode
      const result = sortedNames(options, 'count-asc')

      // The tied pair reads the same way round as it did under the descending mode
      expect(result).toEqual(['Delta', 'Alfa', 'Beta', 'Cyklus'])
    })

    it('treats a missing count as zero', () => {
      // Arrange one option carrying no count at all
      const withMissing: FacetOption[] = [
        { id: 'has', displayName: 'Beta', count: 3 },
        { id: 'none', displayName: 'Alfa' },
      ]

      // Act on the descending mode
      const result = sortedNames(withMissing, 'count-desc')

      // The counted option leads despite being alphabetically later
      expect(result).toEqual(['Beta', 'Alfa'])
    })

    it('collates accented names by locale rather than by code point', () => {
      // Arrange names whose order differs between naive and locale-aware comparison
      const accented: FacetOption[] = [
        { id: 'z', displayName: 'Zeta' },
        { id: 'c', displayName: 'Čísla' },
        { id: 'a', displayName: 'Alfa' },
      ]

      // Act on the alphabetical mode under the Slovak locale
      const result = sortedNames(accented, 'alpha')

      // Č lands among the letters rather than after Z
      expect(result).toEqual(['Alfa', 'Čísla', 'Zeta'])
    })
  })

  describe('groupOptionsByKey', () => {
    // Two options share a key, one has none, and one names a key nobody asks for
    const options: FacetOption[] = [
      { id: '1', displayName: 'Algebra', groupKey: 'area' },
      { id: '2', displayName: 'Indukcia', groupKey: 'technique' },
      { id: '3', displayName: 'Geometria', groupKey: 'area' },
      { id: '4', displayName: 'Bez skupiny' },
      { id: '5', displayName: 'Neznáma skupina', groupKey: 'mystery' },
    ]

    it('buckets options under their own key, preserving the incoming order', () => {
      // Act on the two keys the options actually use
      const result = groupOptionsByKey(options, ['area', 'technique'])

      // Each bucket holds its own options, in the order they arrived
      expect(result.area.map((option) => option.displayName)).toEqual(['Algebra', 'Geometria'])
      expect(result.technique.map((option) => option.displayName)).toEqual(['Indukcia'])
    })

    it('creates an empty bucket for a requested key nothing lands in', () => {
      // Act on a key no option carries
      const result = groupOptionsByKey(options, ['area', 'goal'])

      // The key exists holding nothing, rather than being absent
      expect(result.goal).toEqual([])
    })

    it('drops options whose key was not requested or is absent entirely', () => {
      // Act on a single key, leaving one option ungrouped and one wrongly grouped
      const result = groupOptionsByKey(options, ['area'])

      // Only the requested key exists, and neither stray option found its way into it
      expect(Object.keys(result)).toEqual(['area'])
      expect(result.area).toHaveLength(2)
    })
  })

  describe('orderFlatOptions', () => {
    // Deliberately unsorted, so a stable reorder is distinguishable from a full sort
    const options: FacetOption[] = [
      { id: 'a', displayName: 'Zebra', count: 1 },
      { id: 'b', displayName: 'Alfa', count: 9 },
      { id: 'c', displayName: 'Mika', count: 5 },
      { id: 'd', displayName: 'Beta', count: 3 },
    ]

    it('moves the selected options to the front', () => {
      // Act with two options selected out of the middle and the end
      const result = orderFlatOptions(options, ['c', 'd'])

      // Both lead, and the rest follow
      expect(result.map((option) => option.id)).toEqual(['c', 'd', 'a', 'b'])
    })

    it('leaves the incoming order of each half intact', () => {
      // Act with nothing selected, so only the incoming order can decide
      const result = orderFlatOptions(options, [])

      // Neither name nor count reordered anything
      expect(result.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd'])
    })

    it('returns a new array rather than sorting the incoming one in place', () => {
      // Act on an array the caller still holds
      orderFlatOptions(options, ['c'])

      // The original is as it was, so a memoized caller sees no mutation
      expect(options.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd'])
    })
  })

  describe('orderGroupedOptions', () => {
    // Two sections whose alphabetical and count orders disagree, so the mode is visible
    const options: FacetOption[] = [
      { id: 'a1', displayName: 'Algebra', count: 5, groupKey: 'area' },
      { id: 'a2', displayName: 'Zeta', count: 90, groupKey: 'area' },
      { id: 'a3', displayName: 'Mika', count: 50, groupKey: 'area' },
      { id: 't1', displayName: 'Indukcia', count: 7, groupKey: 'technique' },
      { id: 't2', displayName: 'Sporom', count: 2, groupKey: 'technique' },
    ]

    // Both sections, in the order a grouped facet shows them
    const grouping: FacetGrouping = {
      keys: ['area', 'technique'],
      labels: { area: 'Oblasť', technique: 'Technika' },
    }

    it('concatenates the sections in the configured key order', () => {
      // Act with both sections under the same ordering
      const sortModes: Record<string, FacetSortMode> = { area: 'alpha', technique: 'alpha' }
      const result = orderGroupedOptions(options, grouping, sortModes, [], 'sk')

      // Every option of the first section precedes every option of the second
      expect(result.map((option) => option.id)).toEqual(['a1', 'a3', 'a2', 't1', 't2'])
    })

    it('applies each section its own sort mode', () => {
      // Act with the two sections deliberately under different orderings
      const sortModes: Record<string, FacetSortMode> = { area: 'count-desc', technique: 'alpha' }
      const result = orderGroupedOptions(options, grouping, sortModes, [], 'sk')

      // The first section reads by descending count, the second by name
      expect(result.map((option) => option.id)).toEqual(['a2', 'a3', 'a1', 't1', 't2'])
    })

    it('leads each section with its own selected options', () => {
      // Act with one option selected in each section, neither of which would sort first
      const sortModes: Record<string, FacetSortMode> = { area: 'alpha', technique: 'alpha' }
      const result = orderGroupedOptions(options, grouping, sortModes, ['a2', 't2'], 'sk')

      // Each selected option leads its own section rather than the whole list
      expect(result.map((option) => option.id)).toEqual(['a2', 'a1', 'a3', 't2', 't1'])
    })

    it('drops options belonging to no configured section', () => {
      // Act on a list carrying one ungrouped option and one under an unknown key
      const strays: FacetOption[] = [
        ...options,
        { id: 'x1', displayName: 'Bez skupiny' },
        { id: 'x2', displayName: 'Neznáma', groupKey: 'mystery' },
      ]
      const sortModes: Record<string, FacetSortMode> = { area: 'alpha', technique: 'alpha' }
      const result = orderGroupedOptions(strays, grouping, sortModes, [], 'sk')

      // Neither stray survived, since no section could hold it
      expect(result.map((option) => option.id)).not.toContain('x1')
      expect(result.map((option) => option.id)).not.toContain('x2')
      expect(result).toHaveLength(5)
    })
  })

  describe('toVisibleSections', () => {
    // One section holding options and one that a search could empty
    const grouping: FacetGrouping = {
      keys: ['area', 'technique', 'goal'],
      labels: { area: 'Oblasť', technique: 'Technika', goal: 'Cieľ' },
    }

    it('splits options back into their sections, in the configured key order', () => {
      // Act on options belonging to two of the three sections
      const options: FacetOption[] = [
        { id: 't1', displayName: 'Indukcia', groupKey: 'technique' },
        { id: 'a1', displayName: 'Algebra', groupKey: 'area' },
      ]
      const result = toVisibleSections(options, grouping)

      // The sections read in the configured order, not the order the options arrived in
      expect(result.map((section) => section.groupKey)).toEqual(['area', 'technique'])
      expect(result[0].sectionOptions.map((option) => option.id)).toEqual(['a1'])
    })

    it('drops the sections nothing landed in', () => {
      // Act on options covering a single section
      const options: FacetOption[] = [{ id: 'a1', displayName: 'Algebra', groupKey: 'area' }]
      const result = toVisibleSections(options, grouping)

      // Only the section with something to show survives
      expect(result).toHaveLength(1)
      expect(result[0].groupKey).toBe('area')
    })

    it('yields nothing when every section is empty', () => {
      // Act on an empty list, which is what a search matching nothing leaves
      const result = toVisibleSections([], grouping)

      // No section is offered, rather than three empty ones
      expect(result).toEqual([])
    })
  })
})
