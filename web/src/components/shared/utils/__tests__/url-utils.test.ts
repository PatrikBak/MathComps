import { afterEach, describe, expect, it, vi } from 'vitest'

import { mergeOwnedParams } from '../url-utils'

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
