import { afterEach, describe, expect, it, vi } from 'vitest'

import { addressCarries, mergeOwnedParams } from '../url-utils'

/** The parameters the writer owns in every case. */
const OWNED_PARAMS = ['category', 'area']

/**
 * Puts the reader on an address with this query.
 *
 * @param search - The query, with its leading question mark.
 */
function standOn(search: string) {
  // The window the address is read from, holding only its query
  vi.stubGlobal('window', { location: { search } })
}

afterEach(() => {
  // No window again, so a test that stands nowhere cannot inherit the last one's address
  vi.unstubAllGlobals()
})

describe('mergeOwnedParams', () => {
  it("leaves an address already carrying the writer's parameters as it is, order included", () => {
    // The filter written first, a problem opened after it
    standOn('?category=intermediate&problem=4')

    // The address once the filter says what the address already holds
    const merged = mergeOwnedParams('category=intermediate', OWNED_PARAMS)

    // The address word for word
    expect(merged).toBe('category=intermediate&problem=4')
  })

  it('takes a changed parameter, keeping every parameter the writer does not own', () => {
    // The filter written first, a problem opened after it
    standOn('?category=intermediate&problem=4')

    // The address once the filter narrows to another paper
    const merged = new URLSearchParams(mergeOwnedParams('category=advanced', OWNED_PARAMS))

    // The new paper alone
    expect(merged.getAll('category')).toEqual(['advanced'])

    // The problem still open
    expect(merged.get('problem')).toBe('4')
  })
})

describe('addressCarries', () => {
  it('finds a query on an address holding its parameters in another order, among parameters it leaves out', () => {
    // A problem opened over the filter, written in another order
    standOn('?area=algebra&problem=4&category=intermediate&category=advanced')

    // Whether the address holds what the filter says
    const carried = addressCarries('category=intermediate&category=advanced&area=algebra')

    // Held, parameter for parameter
    expect(carried).toBe(true)
  })

  it('misses a query whose parameter the address dropped or holds with other values', () => {
    // An address narrowed to one paper, a problem opened over it
    standOn('?category=intermediate&problem=4')

    // Whether it holds the filter narrowed to another paper
    const withOne = addressCarries('category=advanced')

    // Whether it holds the filter narrowed to both papers
    const withTwo = addressCarries('category=intermediate&category=advanced')

    // Neither held
    expect(withOne).toBe(false)
    expect(withTwo).toBe(false)
  })
})
