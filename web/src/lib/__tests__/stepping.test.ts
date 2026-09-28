import { describe, expect, it } from 'vitest'

import { canStepFrom, describePosition, stepTarget } from '../stepping'

/** A list of four items, in the order it shows them. */
const LIST = ['a', 'b', 'c', 'd']

describe('canStepFrom', () => {
  it('lets a reader with nothing open step into the list', () => {
    // Entering it is a move forward onto the first item
    expect(canStepFrom(LIST, null, 1)).toBe(true)
  })

  it('offers no way backwards out of a list nobody has entered', () => {
    // There is nothing behind the first item to land on
    expect(canStepFrom(LIST, null, -1)).toBe(false)
  })

  it('offers nothing to step into while the list is empty', () => {
    // Nothing listed, so entering it would land nowhere
    expect(canStepFrom([], null, 1)).toBe(false)
  })

  it('holds at either end', () => {
    // Neither before the first item nor past the last is a place in the list
    expect(canStepFrom(LIST, 'a', -1)).toBe(false)
    expect(canStepFrom(LIST, 'd', 1)).toBe(false)
  })

  it('steps either way from the middle', () => {
    // Both neighbours are there to move to
    expect(canStepFrom(LIST, 'b', 1)).toBe(true)
    expect(canStepFrom(LIST, 'b', -1)).toBe(true)
  })

  it('stays put on an item the list does not hold', () => {
    // An item the list doesn't hold has no place to walk from, either way
    expect(canStepFrom(LIST, 'elsewhere', 1)).toBe(false)
    expect(canStepFrom(LIST, 'elsewhere', -1)).toBe(false)
  })
})

describe('stepTarget', () => {
  it('enters the list at its first item', () => {
    // Nothing open counts as sitting before the list, so forward lands on the first
    expect(stepTarget(LIST, null, 1)).toBe('a')
  })

  it('moves one place along', () => {
    // Onto the neighbour on whichever side was asked for
    expect(stepTarget(LIST, 'b', 1)).toBe('c')
    expect(stepTarget(LIST, 'b', -1)).toBe('a')
  })

  it('names nowhere to go at the end of the list', () => {
    // Forward from the last item has nowhere to land
    expect(stepTarget(LIST, 'd', 1)).toBeNull()
  })

  it('names nowhere to go from an item outside the list', () => {
    // There is no place in the list for the move to start from
    expect(stepTarget(LIST, 'elsewhere', 1)).toBeNull()
  })
})

describe('describePosition', () => {
  it('counts the place the way the reader reads it', () => {
    // Third of four, rather than the index it sits at
    expect(describePosition(LIST, 'c')).toEqual({ index: 3, total: 4 })
  })

  it('reports no place while nothing is open', () => {
    // Nothing open has no place to count
    expect(describePosition(LIST, null)).toBeNull()
  })

  it('reports no place for an item the list does not hold', () => {
    // An item outside the list has no place in it to count
    expect(describePosition(LIST, 'elsewhere')).toBeNull()
  })
})
