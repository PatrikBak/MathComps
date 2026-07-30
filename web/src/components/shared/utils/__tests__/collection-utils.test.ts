import { describe, expect, it } from 'vitest'

import { namesTheSameItems } from '../collection-utils'

describe('namesTheSameItems', () => {
  /** Two empty lists name nothing, which is the same nothing. */
  it('holds for two empty lists', () => {
    // Compare them
    expect(namesTheSameItems([], [])).toBe(true)
  })

  /** The order a list happens to be in says nothing about what it names. */
  it('ignores the order', () => {
    // Compare the same items listed the other way round
    expect(namesTheSameItems(['tone', 'gaveAway'], ['gaveAway', 'tone'])).toBe(true)
  })

  /** Nor does listing something twice. */
  it('ignores repeats', () => {
    // Compare a list repeating an item against one naming it once
    expect(namesTheSameItems(['tone', 'tone'], ['tone'])).toBe(true)
  })

  /** An item on one side only is a real difference. */
  it('fails on an extra item', () => {
    // Compare a list against one naming something more
    expect(namesTheSameItems(['tone'], ['tone', 'gaveAway'])).toBe(false)
  })

  /** Equal counts are not enough when the items differ. */
  it('fails on the same count of different items', () => {
    // Compare two lists of one, naming different things
    expect(namesTheSameItems(['tone'], ['gaveAway'])).toBe(false)
  })
})
