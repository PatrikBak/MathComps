// How a URL becomes filter state. Every path in the live taxonomy is run through this same pipeline in
// competition-equivalence.test.ts, so what is left here is one case per shape a URL comes in rather than one
// per path: what it carries alongside the competitions, and the ways it can be a URL the app cannot honour.

import { describe, expect, it } from 'vitest'

import { ACTIVE_FILTERS_CONSTANTS } from '../constants/filter-constants'
import {
  initializeFiltersFromUrlOrDefaults,
  namesOnlyKnownCompetitions,
} from '../utils/url-initialization'
import { DEEP_TAXONOMY, makeCompetitionTree } from './competition-tree-fixture'

/** The taxonomy the paths in this file resolve against, five levels at its deepest. */
const tree = makeCompetitionTree(DEEP_TAXONOMY)

/**
 * Builds a URL naming the given number of tags, which is the cheapest filter to count out one by one.
 *
 * @param count - How many tags to name.
 * @returns The parameters.
 */
function urlWithTags(count: number): URLSearchParams {
  // One tag apiece, written as the comma-separated list the key is read from
  return new URLSearchParams({
    tags: Array.from({ length: count }, (_, index) => `tag-${index}`).join(','),
  })
}

describe('a URL carrying nothing', () => {
  it('produces the default filters', () => {
    // No parameters at all, which is what the bare archive page loads with
    const params = new URLSearchParams({})

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Nothing filtered on, and nothing to complain about
    expect(result.hasInvalidParams).toBe(false)
    expect(result.filters.searchText).toBe('')
    expect(result.filters.competitionSelection).toEqual([])
  })
})

describe('a URL carrying competitions', () => {
  it('resolves a path at any depth alongside the other filters', () => {
    // A search term and two competitions, one of them four levels down
    const params = new URLSearchParams({ q: 'algebra', competitions: 'mo-a-i-navodne,flat' })

    // The whole URL read at once
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Every part of it understood
    expect(result.hasInvalidParams).toBe(false)
    expect(result.filters.searchText).toBe('algebra')
    expect(result.filters.competitionSelection).toEqual(['mo-a-i-navodne', 'flat'])
  })

  it('falls back to the defaults when a season names no edition', () => {
    // A school year that is not a number, which no edition can answer to
    const params = new URLSearchParams({ seasons: 'abc' })

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Reported broken, since a filter the query cannot carry must not sit on screen as though it applied
    expect(result.hasInvalidParams).toBe(true)
    expect(result.filters.seasons).toEqual([])
  })

  it('takes a path at its word, having no taxonomy to check it against', () => {
    // A link written against a taxonomy this one no longer matches
    const params = new URLSearchParams({ competitions: 'mo-zz' })

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Carried through as written, since the archive resolves paths itself and must be asked first
    expect(result.hasInvalidParams).toBe(false)
    expect(result.filters.competitionSelection).toEqual(['mo-zz'])
  })
})

describe('holding a URL against the taxonomy once it has arrived', () => {
  it('refuses the whole URL for one path among several, rather than dropping just that one', () => {
    // One competition four levels down that is still there, beside one that is not
    const params = new URLSearchParams({ competitions: 'mo-a-i-navodne,mo-zz' })

    // The URL read
    const { filters } = initializeFiltersFromUrlOrDefaults(params)

    // Held against the taxonomy, a filter honoured in part being worse than one obviously refused
    expect(namesOnlyKnownCompetitions(filters, tree)).toBe(false)

    // The surviving competition on its own
    const { filters: onlyLive } = initializeFiltersFromUrlOrDefaults(
      new URLSearchParams({ competitions: 'mo-a-i-navodne' })
    )

    // Honoured, so it really is the gone one doing this
    expect(namesOnlyKnownCompetitions(onlyLive, tree)).toBe(true)
  })
})

describe('a URL the app cannot honour', () => {
  it('rejects a parameter it does not recognise', () => {
    // A parameter no filter answers to, which usually means a hand-edited or stale link
    const params = new URLSearchParams({ unknownParam: 'value' })

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // One key nobody recognises condemns the whole URL
    expect(result.hasInvalidParams).toBe(true)
  })
})

describe('the most filters a URL may carry', () => {
  it('applies exactly as many as the limit allows', () => {
    // The limit itself, which the archive's own controls let a reader reach and then share
    const params = urlWithTags(ACTIVE_FILTERS_CONSTANTS.maxFilterLimit)

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Every one of them applied, so each tag did count as exactly one filter
    expect(result.hasTooManyFilters).toBe(false)
    expect(result.filters.tags).toHaveLength(ACTIVE_FILTERS_CONSTANTS.maxFilterLimit)
  })

  it('refuses one filter more than that', () => {
    // The first count past the limit, which exists to keep a hand-written URL from melting the query
    const params = urlWithTags(ACTIVE_FILTERS_CONSTANTS.maxFilterLimit + 1)

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // The filters are dropped wholesale rather than truncated, and the URL itself reads as sound
    expect(result.hasTooManyFilters).toBe(true)
    expect(result.hasInvalidParams).toBe(false)
    expect(result.filters.tags).toEqual([])
  })
})

describe('the filters that need the reader signed in', () => {
  it('applies a favourites filter', () => {
    // The reader's own likes
    const params = new URLSearchParams({ favoritesOnly: 'true' })

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Applied like any other, since who may keep it is weighed further along
    expect(result.filters.favoritesOnly).toBe(true)
  })

  it('applies a list filter', () => {
    // One list rather than the whole library
    const params = new URLSearchParams({ list: 'abc123' })

    // The URL read
    const result = initializeFiltersFromUrlOrDefaults(params)

    // Naming the list the URL asked for
    expect(result.filters.listContentId).toBe('abc123')
  })
})
