import { describe, expect, it } from 'vitest'

import {
  type AddressedPoolFilter,
  fromPoolFilterQuery,
  POOL_FILTER_PARAMS,
  toPoolFilterQuery,
} from '../pool-filter-url'
import { OPEN_POOL_FILTER } from '../pool-filters'

/** A pool narrowed every way the address can say, for the round trip to carry. */
const FULLY_NARROWED: AddressedPoolFilter = {
  query: 'triangle ',
  categories: ['elementary', 'advanced'],
  areas: ['geometry', 'numberTheory'],
  isShowingSetAside: true,
}

/**
 * Reads a query string the way the pool does.
 *
 * @param query - The query string, without its leading question mark.
 *
 * @returns What the address narrows the pool to.
 */
function read(query: string): AddressedPoolFilter {
  // What the pool would show on landing there
  return fromPoolFilterQuery(new URLSearchParams(query))
}

describe('toPoolFilterQuery', () => {
  it('carries nothing when nothing narrows the pool', () => {
    // The pool narrowed by nothing, written into the address
    const query = toPoolFilterQuery(OPEN_POOL_FILTER)

    // A bare address, carrying no query of the pool's at all
    expect(query).toBe('')
  })

  it('writes only the parameters the filter owns', () => {
    // The parameters a fully narrowed filter writes
    const written = [...new URLSearchParams(toPoolFilterQuery(FULLY_NARROWED)).keys()]

    // Each one owned, or every write of the filter would leave the last one's value standing beside its own
    expect(
      written.filter((param) => !(POOL_FILTER_PARAMS as readonly string[]).includes(param))
    ).toEqual([])
  })
})

describe('fromPoolFilterQuery', () => {
  it('reads back everything it wrote', () => {
    // Round-tripped through the address, the search's trailing space included
    expect(read(toPoolFilterQuery(FULLY_NARROWED))).toEqual(FULLY_NARROWED)
  })

  it('keeps only the options a facet has, in the order it lists them', () => {
    // Read off an address naming categories out of order and twice, and values no facet has an option for
    const filter = read(
      'category=advanced&category=bogus&category=elementary&category=advanced&area=nope'
    )

    // The real ones, once each and as the facets list them
    expect(filter.categories).toEqual(['elementary', 'advanced'])
    expect(filter.areas).toEqual([])
  })
})
