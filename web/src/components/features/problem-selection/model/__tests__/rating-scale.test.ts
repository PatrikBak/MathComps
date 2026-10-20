import { describe, expect, it } from 'vitest'

import { scoreAt, stepScore } from '../rating-scale'

describe('scoreAt', () => {
  it('gives the half below a whole score for the left half of its fifth of the bar, and the score for the right', () => {
    // Either half of the fourth fifth
    expect([scoreAt(0.65), scoreAt(0.75)]).toEqual([3.5, 4])
  })

  it('keeps a press on the line between two steps on the lower one', () => {
    // The line between 2 and 2.5
    expect(scoreAt(0.4)).toBe(2)
  })

  it('gives the lowest score for anywhere in the first fifth, the left edge too', () => {
    // The edge and the first fifth's left half
    expect([scoreAt(0), scoreAt(0.05)]).toEqual([1, 1])
  })
})

describe('stepScore', () => {
  it('lands on a tenth however many tenths it has moved through', () => {
    // A tenth up from 3.5 and from 3.6, then half a score up from 3.7, where adding 0.1 to 3.6
    // gives 3.7000000000000002
    expect([stepScore(3.5, 1), stepScore(3.6, 1), stepScore(3.7, 5)]).toEqual([3.6, 3.7, 4.2])
  })

  it('moves no score up onto the lowest, and leaves it none moving down', () => {
    // Up and down from no score
    expect([stepScore(null, 1), stepScore(null, -1)]).toEqual([1, null])
  })
})
