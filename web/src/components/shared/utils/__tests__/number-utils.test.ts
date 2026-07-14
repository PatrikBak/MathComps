import { describe, expect, it } from 'vitest'

import { roundTo } from '../number-utils'

describe('roundTo', () => {
  it('scales to the given decimals and rounds to nearest', () => {
    // A long decimal below the halfway point rounds down
    expect(roundTo(12.3412, 2)).toBe(12.34)
    // A long decimal above the halfway point rounds up
    expect(roundTo(12.3456, 2)).toBe(12.35)
  })
})
