import { describe, expect, it } from 'vitest'

import { OPEN_POOL_FILTER, withListedTargets } from '../pool-filter'
import { recommendationTargetsOf } from '../recommendation-targets'
import type { Board } from '../selection-types'

describe('withListedTargets', () => {
  it('keeps the targets a problem can be recommended for, in the order they run', () => {
    // A draft whose one paper, the warm-up, has no category
    const warmUp: Board = {
      id: 'warm-up',
      name: 'Warm-up',
      papers: [{ id: 'warm-up-paper', name: 'Warm-up', category: null, slots: [] }],
      cycle: null,
    }

    // A selection running elementary, then advanced, with the warm-up draft
    const targets = recommendationTargetsOf(
      [
        { name: 'elementary', hostedCategory: 'elementary' },
        { name: 'advanced', hostedCategory: 'advanced' },
      ],
      [warmUp]
    )

    // A filter picking the warm-up paper, advanced, a target nobody lists, and elementary, in that order
    const picked = {
      ...OPEN_POOL_FILTER,
      targets: ['warm-up-paper', 'advanced', 'nowhere', 'elementary'],
    }

    // The categories in the order they run, then the paper
    expect(withListedTargets(picked, targets).targets).toEqual([
      'elementary',
      'advanced',
      'warm-up-paper',
    ])
  })
})
