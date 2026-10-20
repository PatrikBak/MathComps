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

  it('keeps every newcomer waiting outside a list that has shown something, and fills one that has shown nothing', () => {
    // A list shown as A, B, whose items now come in with C new on top
    const seen = ['A', 'B']

    // C, set to wait
    const kept = withNewcomers(seen, ['C', 'B', 'A'], ['C'], 'waiting')

    // C kept out, and the very same list handed back, which tells a list holding its order that nothing moved
    expect(kept).toBe(seen)

    // The same three coming into a list that has shown nothing yet
    const filled = withNewcomers([], ['C', 'B', 'A'], ['C', 'B', 'A'], 'waiting')

    // All of them taken, in the order they come in
    expect(filled).toEqual(['C', 'B', 'A'])
  })
})
