import { describe, expect, it } from 'vitest'

import {
  type DefenseHistoryRead,
  type DefenseOpeningStatus,
  type HistoryRefresh,
  resolveOpening,
} from '../defense-opening'
import { toWireTarget } from '../defense-target'
import type { DefenseSession } from '../defense-types'

/** The problem every conversation here is held against. */
const TARGET = toWireTarget({
  kind: 'handout',
  environment: { handoutContentId: 'handout-1', environmentId: 'p1' },
})

/** The most recently active conversation saved against the problem. */
const NEWER: DefenseSession = {
  id: 'newer',
  target: TARGET,
  statement: 'Prove it.',
  hasOlderStatement: false,
  turns: [],
  feedback: null,
  reports: [],
}

/** An older conversation saved against the problem. */
const OLDER: DefenseSession = {
  id: 'older',
  target: TARGET,
  statement: 'Prove it.',
  hasOlderStatement: false,
  turns: [],
  feedback: null,
  reports: [],
}

/**
 * A history in hand holding both conversations.
 *
 * @param isOutdated - Whether it is known to miss a write made since it was read.
 * @param refresh - Where a newer read of it stands.
 *
 * @returns The history.
 */
function inHand(isOutdated: boolean, refresh: HistoryRefresh): DefenseHistoryRead {
  // Most recently active first, as the history always lists them
  return { kind: 'inHand', sessions: [NEWER, OLDER], isOutdated, refresh }
}

/** Nothing of the history read yet. */
const AWAITED: DefenseHistoryRead = { kind: 'awaited' }

/** Nothing of the history read, the read having given up. */
const UNREADABLE: DefenseHistoryRead = { kind: 'unreadable' }

/** The conversation is still to be learned. */
const WAITING: DefenseOpeningStatus = { kind: 'waiting' }

/** The conversation can no longer be learned. */
const UNREACHABLE: DefenseOpeningStatus = { kind: 'unreachable' }

/**
 * The conversation is known.
 *
 * @param conversation - The saved one to carry on, or null for a blank one.
 *
 * @returns The status.
 */
function decided(conversation: DefenseSession | null): DefenseOpeningStatus {
  // Known, and which one
  return { kind: 'decided', conversation }
}

/** Every state the history can be in, each beside a name for it. */
const EVERY_HISTORY: [string, DefenseHistoryRead][] = [
  ['nothing read yet', AWAITED],
  ['a read that gave up', UNREADABLE],
  ['a current list', inHand(false, 'none')],
  ['a current list being read again', inHand(false, 'coming')],
  ['a current list whose newer read gave up', inHand(false, 'failed')],
  ['an outdated list being read again', inHand(true, 'coming')],
  ['an outdated list whose newer read gave up', inHand(true, 'failed')],
  ['an outdated list with no newer read on its way', inHand(true, 'none')],
]

describe('resolveOpening', () => {
  it.each(EVERY_HISTORY)('opens a fresh conversation at once on %s', (_description, history) => {
    // Nothing the history holds is ever carried on
    expect(resolveOpening({ kind: 'fresh' }, history)).toEqual(decided(null))
  })

  it.each<[string, DefenseHistoryRead, DefenseOpeningStatus]>([
    ['nothing read yet', AWAITED, WAITING],
    ['a read that gave up', UNREADABLE, UNREACHABLE],
    ['a current list', inHand(false, 'none'), decided(NEWER)],
    ['a current list being read again', inHand(false, 'coming'), decided(NEWER)],
    ['a current list whose newer read gave up', inHand(false, 'failed'), decided(NEWER)],
    ['an outdated list being read again', inHand(true, 'coming'), WAITING],
    ['an outdated list whose newer read gave up', inHand(true, 'failed'), UNREACHABLE],
    ['an outdated list with no newer read on its way', inHand(true, 'none'), WAITING],
  ])('opens the newest conversation off %s', (_description, history, expected) => {
    // A write since the read may have made a different one the newest
    expect(resolveOpening({ kind: 'newest' }, history)).toEqual(expected)
  })

  it.each<[string, DefenseHistoryRead, DefenseOpeningStatus]>([
    ['nothing read yet', AWAITED, WAITING],
    ['a read that gave up', UNREADABLE, UNREACHABLE],
    ['a current list', inHand(false, 'none'), decided(OLDER)],
    ['a current list being read again', inHand(false, 'coming'), decided(OLDER)],
    ['a current list whose newer read gave up', inHand(false, 'failed'), decided(OLDER)],
    ['an outdated list being read again', inHand(true, 'coming'), decided(OLDER)],
    ['an outdated list whose newer read gave up', inHand(true, 'failed'), decided(OLDER)],
    ['an outdated list with no newer read on its way', inHand(true, 'none'), decided(OLDER)],
  ])('opens a named conversation the list holds off %s', (_description, history, expected) => {
    // Found, it is the one, whatever a newer read brings
    expect(resolveOpening({ kind: 'named', sessionId: OLDER.id }, history)).toEqual(expected)
  })

  it.each<[string, DefenseHistoryRead, DefenseOpeningStatus]>([
    ['nothing read yet', AWAITED, WAITING],
    ['a read that gave up', UNREADABLE, UNREACHABLE],
    ['a current list', inHand(false, 'none'), decided(null)],
    ['a current list being read again', inHand(false, 'coming'), WAITING],
    ['a current list whose newer read gave up', inHand(false, 'failed'), UNREACHABLE],
    ['an outdated list being read again', inHand(true, 'coming'), WAITING],
    ['an outdated list whose newer read gave up', inHand(true, 'failed'), UNREACHABLE],
    ['an outdated list with no newer read on its way', inHand(true, 'none'), WAITING],
  ])('opens a named conversation the list lacks off %s', (_description, history, expected) => {
    // Missing, it may yet come with a newer read, and is given up on only once none can
    expect(resolveOpening({ kind: 'named', sessionId: 'written-elsewhere' }, history)).toEqual(
      expected
    )
  })
})
