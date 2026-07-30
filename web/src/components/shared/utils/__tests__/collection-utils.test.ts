import { describe, expect, it } from 'vitest'

import { namesTheSameItems } from '../collection-utils'

describe('namesTheSameItems', () => {
  /** Two empty lists name nothing, which is the same nothing. */
  it('holds for two empty lists', () => {
    // Compare two lists that name nothing
    expect(namesTheSameItems([], [])).toBe(true)
  })

  /** The order a list happens to be in says nothing about what it names. */
  it('ignores the order', () => {
    // Compare the same items listed the other way round
    expect(namesTheSameItems(['alpha', 'beta'], ['beta', 'alpha'])).toBe(true)
  })

  /** Listing an item twice names no more than listing it once. */
  it('ignores repeats', () => {
    // Compare a list repeating an item against one naming it once
    expect(namesTheSameItems(['alpha', 'alpha'], ['alpha'])).toBe(true)
  })

  /** An item on one side only is a real difference. */
  it('fails on an extra item', () => {
    // Compare a list against one naming something more
    expect(namesTheSameItems(['alpha'], ['alpha', 'beta'])).toBe(false)
  })

  /** Equal counts are not enough when the items differ. */
  it('fails on the same count of different items', () => {
    // Compare two lists of one, naming different things
    expect(namesTheSameItems(['alpha'], ['beta'])).toBe(false)
  })
})
