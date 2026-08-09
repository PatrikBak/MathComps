import { describe, expect, it } from 'vitest'

import {
  canStepFrom,
  describePosition,
  findNextUnreadId,
  stepTarget,
} from '../defense-review-stepping'

/** A queue of four loaded conversations, in the order it shows them. */
const QUEUE = ['a', 'b', 'c', 'd']

describe('canStepFrom', () => {
  it('lets a reader with nothing open step into the queue', () => {
    // Entering it is a move forward onto the first conversation
    expect(canStepFrom(QUEUE, null, 1)).toBe(true)
  })

  it('offers no way backwards out of a queue nobody has entered', () => {
    // There is nothing behind the first conversation to land on
    expect(canStepFrom(QUEUE, null, -1)).toBe(false)
  })

  it('offers nothing to step into while the queue is empty', () => {
    // Nothing loaded, so entering it would land nowhere
    expect(canStepFrom([], null, 1)).toBe(false)
  })

  it('holds at either end', () => {
    // Neither before the first conversation nor past the last is a place in the queue
    expect(canStepFrom(QUEUE, 'a', -1)).toBe(false)
    expect(canStepFrom(QUEUE, 'd', 1)).toBe(false)
  })

  it('steps either way from the middle', () => {
    // Both neighbours are there to move to
    expect(canStepFrom(QUEUE, 'b', 1)).toBe(true)
    expect(canStepFrom(QUEUE, 'b', -1)).toBe(true)
  })

  it('stays put on a conversation the loaded queue does not hold', () => {
    // Opened from the notes feed, or left behind by a filter, so there is no place in the queue to walk from
    // Neither direction is a move anybody asked for
    expect(canStepFrom(QUEUE, 'elsewhere', 1)).toBe(false)
    expect(canStepFrom(QUEUE, 'elsewhere', -1)).toBe(false)
  })
})

describe('stepTarget', () => {
  it('enters the queue at its first conversation', () => {
    // Nothing open counts as sitting before the queue, so forward lands on the first
    expect(stepTarget(QUEUE, null, 1)).toBe('a')
  })

  it('moves one place along', () => {
    // Onto the neighbour on whichever side was asked for
    expect(stepTarget(QUEUE, 'b', 1)).toBe('c')
    expect(stepTarget(QUEUE, 'b', -1)).toBe('a')
  })

  it('names nowhere to go at the end of the queue', () => {
    // Which is what leaves the reader where they are
    expect(stepTarget(QUEUE, 'd', 1)).toBeNull()
  })

  it('names nowhere to go from a conversation outside the queue', () => {
    // There is no place in the queue for the move to start from
    expect(stepTarget(QUEUE, 'elsewhere', 1)).toBeNull()
  })
})

describe('findNextUnreadId', () => {
  it('skips what has already been read', () => {
    // Only the last of them is still unread
    const unread = new Set(['d'])

    // The two read ones in between are passed over
    expect(findNextUnreadId(QUEUE, 'a', unread)).toBe('d')
  })

  it('starts a reader with nothing open at the first unread conversation', () => {
    // The walk starts before the queue, so the earliest unread one is the next
    expect(findNextUnreadId(QUEUE, null, new Set(['b', 'c']))).toBe('b')
  })

  it('never works backwards over what the reader has passed', () => {
    // The only unread one sits behind the conversation being read
    const unread = new Set(['a'])

    // A backlog is worked towards the end, never back over what was passed
    expect(findNextUnreadId(QUEUE, 'c', unread)).toBeNull()
  })

  it('passes over the conversation being read even while it counts as unread', () => {
    // Offering it would be a move that lands where the reader already is
    expect(findNextUnreadId(QUEUE, 'b', new Set(['b']))).toBeNull()
  })

  it('offers no next from a conversation outside the queue', () => {
    // It names no place to work forward from
    expect(findNextUnreadId(QUEUE, 'elsewhere', new Set(['a', 'b']))).toBeNull()
  })

  it('offers nothing once the rest of the queue has been read', () => {
    // Which is what takes the move off the header
    expect(findNextUnreadId(QUEUE, 'a', new Set())).toBeNull()
  })
})

describe('describePosition', () => {
  it('counts the place the way the reader reads it', () => {
    // Third of four, rather than the index it sits at
    expect(describePosition(QUEUE, 'c')).toEqual({ index: 3, total: 4 })
  })

  it('reports no place while nothing is open', () => {
    // Which is what keeps the count off the header until there is something to count
    expect(describePosition(QUEUE, null)).toBeNull()
  })

  it('reports no place for a conversation the queue does not hold', () => {
    // Counting it would put it somewhere the reader can't step back to
    expect(describePosition(QUEUE, 'elsewhere')).toBeNull()
  })
})
