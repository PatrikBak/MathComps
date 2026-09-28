import { describe, expect, it } from 'vitest'

import { createSettlingWrites } from '../settling-writes'

describe('createSettlingWrites', () => {
  it('lets the one write on a record decide what it says', () => {
    // One write, made on a record that read 1
    const writes = createSettlingWrites<number>()
    writes.begin('record')
    writes.holdBefore('record', 1)

    // Landing, with nothing behind it
    expect(writes.land('record', 2)).toBe(true)
  })

  it('puts back what a landed write left when the write after it is refused', () => {
    // Two writes on a record that read 1
    const writes = createSettlingWrites<number>()
    writes.begin('record')
    writes.holdBefore('record', 1)
    writes.begin('record')

    // The first lands, leaving 2, with the second still behind it
    expect(writes.land('record', 2)).toBe(false)

    // The first write settles
    writes.settle('record')

    // The second is refused, and 2 is what the server holds
    expect(writes.refuse('record')).toEqual({ state: 2 })
  })

  it('leaves a refused write to the one behind it', () => {
    // Two writes on a record that read 1
    const writes = createSettlingWrites<number>()
    writes.begin('record')
    writes.holdBefore('record', 1)
    writes.begin('record')

    // The first is refused while the second is still settling
    expect(writes.refuse('record')).toBeNull()

    // The first write settles
    writes.settle('record')

    // The second lands, and is the last left to decide
    expect(writes.land('record', 3)).toBe(true)
  })

  it('keeps the state from before the set, whatever a later write reads', () => {
    // A tracker for a record that read 1
    const writes = createSettlingWrites<number>()

    // The first write opens the set, holding 1
    expect(writes.begin('record')).toBe(true)
    writes.holdBefore('record', 1)

    // The second joins the set, reading the 2 the first optimistically wrote
    expect(writes.begin('record')).toBe(false)
    writes.holdBefore('record', 2)

    // The first write settles, with the second still out
    writes.settle('record')

    // The second is refused, and the record goes back to what it said before either write
    expect(writes.refuse('record')).toEqual({ state: 1 })
  })

  it('tells an empty state apart from nothing held', () => {
    // A record whose state is itself empty
    const writes = createSettlingWrites<number | null>()
    writes.begin('empty')
    writes.holdBefore('empty', null)

    // A second record, never read at all
    writes.begin('unread')

    // The empty state is put back
    expect(writes.refuse('empty')).toEqual({ state: null })

    // Nothing is put back where nothing was held
    expect(writes.refuse('unread')).toBeNull()

    // Nor does a landed write move on a record with nothing held
    expect(writes.land('unread', 1)).toBe(false)
  })

  it('starts a record afresh once every write on it has settled', () => {
    // One write on a record that read 1
    const writes = createSettlingWrites<number>()
    writes.begin('record')
    writes.holdBefore('record', 1)

    // The write lands, leaving 2
    writes.land('record', 2)

    // The write settles, closing the set
    writes.settle('record')

    // A new write opens a new set, holding what the record reads now
    expect(writes.begin('record')).toBe(true)
    writes.holdBefore('record', 5)

    // Which is what a refusal puts back
    expect(writes.refuse('record')).toEqual({ state: 5 })
  })
})
