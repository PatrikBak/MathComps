import { describe, expect, it } from 'vitest'

import { findNextUnreadId } from '../defense-review-stepping'

/** A queue of four loaded conversations, in the order it shows them. */
const QUEUE = ['a', 'b', 'c', 'd']

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
