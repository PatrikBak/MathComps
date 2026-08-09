import { describe, expect, it } from 'vitest'

import type { DefenseReviewFilter } from '../defense-review-types'
import {
  type DefenseReviewUrlState,
  fromDefenseReviewQuery,
  toDefenseReviewQuery,
} from '../defense-review-url'

/**
 * A queue whose filter has nothing left out, so that a field added to {@link DefenseReviewFilter} without
 * being added to the fixture fails to compile: the round trip below can only catch a field the address
 * mangles, never one the address was never asked to carry.
 */
type FullyNarrowedQueue = {
  /** Every one of the filter's fields, each narrowing something. */
  filter: Required<DefenseReviewFilter>
  /** The conversation being read. */
  openId: string
}

/** A queue narrowed every way it can be, for the round trip to carry. */
const FULLY_NARROWED: FullyNarrowedQueue = {
  filter: {
    unread: true,
    hasNotes: false,
    studentReported: true,
    studentFeedback: true,
    userId: '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607',
    handoutContentId: 'handout-1',
    environmentId: 'problem-1',
    withinDays: 30,
    promptVersion: 'abc123',
  },
  openId: 'session-1',
}

/**
 * Reads a query string the way the hooks do.
 *
 * @param query - The query string, without its leading question mark.
 * @returns What the queue should show.
 */
function read(query: string): DefenseReviewUrlState {
  // What the queue would show on landing there
  return fromDefenseReviewQuery(new URLSearchParams(query))
}

describe('toDefenseReviewQuery', () => {
  it('carries nothing when the queue is showing everything', () => {
    // A queue narrowed to nothing, with nothing open
    const query = toDefenseReviewQuery({ filter: {}, openId: null })

    // A bare path, so the queue's own address carries no query at all
    expect(query).toBe('')
  })

  it('writes a false flag out rather than leaving it to absence', () => {
    // "Carries no notes" and "not filtered on notes" are different queues
    const query = toDefenseReviewQuery({ filter: { hasNotes: false }, openId: null })

    // Written out as a 0, which is what survives a reload
    expect(query).toBe('hasNotes=0')
  })

  it('leaves out a problem named without its handout, which a reload would drop anyway', () => {
    // Half a problem, which is what the facet holds for the moment between setting the two fields
    const query = toDefenseReviewQuery({ filter: { environmentId: 'problem-1' }, openId: null })

    // Kept out of the address, so it never says a narrowing that coming back to it wouldn't reproduce
    expect(query).toBe('')
  })

  it('sorts its parameters so one queue is always one address', () => {
    // A filter on three fields, with a conversation open alongside it
    const filter: DefenseReviewFilter = { unread: true, userId: 'u1', withinDays: 7 }

    // Alphabetical, so the conversation named last still leads the address
    expect(toDefenseReviewQuery({ filter, openId: 's1' })).toBe(
      'open=s1&unread=1&userId=u1&withinDays=7'
    )
  })
})

describe('fromDefenseReviewQuery', () => {
  it('reads back everything it wrote', () => {
    // Round-tripped through the address
    const readBack = read(toDefenseReviewQuery(FULLY_NARROWED))

    // Every field survives, so a handed-over address opens on the same queue
    expect(readBack).toEqual(FULLY_NARROWED)
  })

  it('ignores a flag that says anything other than 1 or 0', () => {
    // Neither reads as a narrowing, so the field is left out
    expect(read('hasNotes=yes').filter.hasNotes).toBeUndefined()
    expect(read('hasNotes=').filter.hasNotes).toBeUndefined()
  })

  it('ignores a one-way flag turned off, which narrows nothing anyway', () => {
    // A field held as false would read as a filter that is on while showing everything
    expect(read('unread=0').filter.unread).toBeUndefined()
    expect(read('studentReported=0').filter.studentReported).toBeUndefined()
    expect(read('studentFeedback=0').filter.studentFeedback).toBeUndefined()
  })

  it('ignores a student id that is not shaped like one', () => {
    // The wire takes a GUID here, so anything else is a request refused rather than a queue narrowed
    expect(read('userId=bob').filter.userId).toBeUndefined()
    expect(read('userId=3f2a1b4c-5d6e-4f70-8a91').filter.userId).toBeUndefined()

    // One really shaped like an id narrows the queue to that student
    expect(read('userId=3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607').filter.userId).toBe(
      '3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607'
    )
  })

  it('ignores a period that is not a whole number of days', () => {
    // Text, a fraction, a period of no days, and a negative one: none of them narrows the queue
    expect(read('withinDays=abc').filter.withinDays).toBeUndefined()
    expect(read('withinDays=1.5').filter.withinDays).toBeUndefined()
    expect(read('withinDays=0').filter.withinDays).toBeUndefined()
    expect(read('withinDays=-7').filter.withinDays).toBeUndefined()

    // A whole number of days stands
    expect(read('withinDays=7').filter.withinDays).toBe(7)
  })

  it('ignores a period spelled as anything but a plain count of days', () => {
    // Every one of these is a number to Number, and none of them is a period somebody typed
    expect(read('withinDays=0x10').filter.withinDays).toBeUndefined()
    expect(read('withinDays=1e3').filter.withinDays).toBeUndefined()
    expect(read('withinDays=7.0').filter.withinDays).toBeUndefined()
    expect(read('withinDays= 7 ').filter.withinDays).toBeUndefined()
  })

  it('ignores a period reaching further back than any queue does', () => {
    // Past the cap, which is somebody's typing rather than a period
    expect(read('withinDays=99999999999').filter.withinDays).toBeUndefined()
  })

  it('drops a problem named without its handout', () => {
    // A problem's id only means anything within the handout it belongs to
    expect(read('environmentId=problem-1').filter).toEqual({})

    // Named together, both stand
    expect(read('handoutContentId=handout-1&environmentId=problem-1').filter).toEqual({
      handoutContentId: 'handout-1',
      environmentId: 'problem-1',
    })
  })

  it('reads an empty open parameter as nothing open', () => {
    // Rather than opening the dialog on a conversation with no id
    expect(read('open=').openId).toBeNull()
  })
})
