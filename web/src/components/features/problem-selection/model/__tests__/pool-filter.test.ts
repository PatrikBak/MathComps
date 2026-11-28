import { describe, expect, it } from 'vitest'

import { OPEN_POOL_FILTER, withListedCategories } from '../pool-filter'
import type { SelectionCategory } from '../selection-types'

describe('withListedCategories', () => {
  it("keeps the categories the selection lists, in the selection's order", () => {
    // A selection running elementary, then advanced
    const categories: SelectionCategory[] = [
      { name: 'elementary', hostedCategory: 'elementary' },
      { name: 'advanced', hostedCategory: 'advanced' },
    ]

    // An address naming advanced, a category nobody lists, and elementary, in that order
    const picked = { ...OPEN_POOL_FILTER, categories: ['advanced', 'nowhere', 'elementary'] }

    // The categories the selection lists, in the order they run
    expect(withListedCategories(picked, categories).categories).toEqual(['elementary', 'advanced'])
  })
})
