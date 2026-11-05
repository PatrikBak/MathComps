import { describe, expect, it } from 'vitest'

import {
  type AddressedPoolFilter,
  fromPoolFilterQuery,
  POOL_FILTER_PARAMS,
  type PoolPicks,
  toPoolFilterQuery,
  withAddressed,
  withPickedFilter,
} from '../pool-filter-url'
import { OPEN_POOL_FILTER, type PoolFilter } from '../pool-filters'

/** A pool narrowed every way the address can say, for the round trip to carry. */
const FULLY_NARROWED: AddressedPoolFilter = {
  query: 'triangle ',
  categories: ['elementary', 'advanced'],
  areas: ['geometry', 'numberTheory'],
  isShowingSetAside: true,
  standing: 'wholePaper',
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

/**
 * The picks a reader's change leaves on a pool narrowed by nothing.
 *
 * @param filter - What the change narrows the pool to.
 *
 * @returns The picks.
 */
function picked(filter: Partial<PoolFilter>): PoolPicks {
  // The change, made on picks narrowing nothing
  return withPickedFilter(
    { filter: OPEN_POOL_FILTER, boardPick: null },
    { ...OPEN_POOL_FILTER, ...filter }
  )
}

describe('toPoolFilterQuery', () => {
  it('carries nothing when nothing narrows the pool', () => {
    // The pool narrowed by nothing, written into the address
    const query = toPoolFilterQuery(OPEN_POOL_FILTER)

    // A bare address, carrying no query of the pool's at all
    expect(query).toBe('')
  })

  it('leaves an answer on or off the board out, which follows the board on screen', () => {
    // The pool narrowed to the problems the board on screen holds, written into the address
    const query = toPoolFilterQuery({ ...OPEN_POOL_FILTER, standing: 'selected' })

    // A bare address
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

  it('keeps only the areas the facet has, and each category once as the address names it', () => {
    // Read off an address naming categories out of order and twice, and an area the facet has no option for
    const filter = read(
      'category=advanced&category=bogus&category=elementary&category=advanced&area=nope'
    )

    // Every category once, the selection's own categories not known yet, and no area
    expect(filter.categories).toEqual(['advanced', 'bogus', 'elementary'])
    expect(filter.areas).toEqual([])
  })
})

describe('withAddressed', () => {
  it('keeps an answer on or off the board through every step, one to a whole paper included, and takes a whole paper only from the address', () => {
    // The problems the board holds picked
    const selected = picked({ standing: 'selected' })

    // An address naming the geometry area alone
    const geometry = read('area=geometry')

    // A step to the geometry address keeps the problems the board holds picked, the address's area in
    expect(withAddressed(selected, geometry).filter).toEqual({
      ...OPEN_POOL_FILTER,
      areas: ['geometry'],
      standing: 'selected',
    })

    // A step to an address naming a whole paper
    const onWholePaper = withAddressed(selected, read('state=wholePaper'))

    // The whole paper taken over the problems the board holds
    expect(onWholePaper.filter.standing).toBe('wholePaper')

    // A step on to an address naming no answer, which brings the problems the board holds back
    expect(withAddressed(onWholePaper, geometry).filter.standing).toBe('selected')

    // A whole paper the reader picked
    const pickedWholePaper = picked({ standing: 'wholePaper' })

    // The whole paper dropped on a step to an address no longer naming it
    expect(withAddressed(pickedWholePaper, geometry).filter.standing).toBeNull()
  })
})

describe('withPickedFilter', () => {
  it('keeps the answer on or off the board picked last while a change leaves the State answer alone, and lets it go once none is picked', () => {
    // The problems the board holds picked, then a step to an address naming a whole paper
    const onWholePaper = withAddressed(picked({ standing: 'selected' }), read('state=wholePaper'))

    // A search typed on the whole paper's address, which leaves the State answer alone
    const searched = withPickedFilter(onWholePaper, { ...onWholePaper.filter, query: 'triangle' })

    // The problems the board holds still to come back
    expect(searched.boardPick).toBe('selected')

    // No answer picked after the search, which lets the problems the board holds go
    expect(withPickedFilter(searched, { ...searched.filter, standing: null }).boardPick).toBeNull()
  })
})
