import { describe, expect, it } from 'vitest'

import { withNewcomers } from '../first-seen-order'

describe('withNewcomers', () => {
  it('puts each newcomer in place right after the key it comes in behind, or on top when it comes in first', () => {
    // A list shown as A, B, C, whose items now come in with C moved up and D, E and F new
    const seen = ['A', 'B', 'C']
    const incoming = ['D', 'C', 'A', 'E', 'F', 'B']

    // The newcomers placed
    const order = withNewcomers(seen, incoming, ['D', 'E', 'F'], 'inPlace')

    // D on top, E right after A, F right after E, and C still where it stood
    expect(order).toEqual(['D', 'A', 'E', 'F', 'B', 'C'])
  })
})
