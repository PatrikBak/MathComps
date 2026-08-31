import { describe, expect, it } from 'vitest'

import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS } from '@/components/shared/utils/time-units'

import type { AreaEntry } from '../hosted-competition-state'
import {
  areNotesOpen,
  clockDisplayMode,
  clockMinuteFraction,
  clockMinutesLeft,
  derivePhase,
  deriveStanding,
  entryEndsAt,
  hasEntryEnded,
  orderForReading,
  readAreaRun,
  toAreaEntry,
  wasHandedInEarly,
} from '../hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionEntry,
  HostedCompetitionGroup,
  SatEntry,
} from '../hosted-competition-types'

/** The instant every case below is read against. */
const NOW = Date.parse('2026-09-20T12:00:00Z')

/** How long every competition below runs, in minutes. */
const CLOCK_MINUTES = 120

/**
 * Builds an entry from how its clock sits against {@link NOW}.
 *
 * @param endsInMs - How long is left on the clock, negative once it has run out.
 * @param finishedAt - When the student closed it themselves, or null while they have not.
 *
 * @returns The entry.
 */
function entryOf(endsInMs: number, finishedAt: string | null): HostedCompetitionEntry {
  // A clock as long as the group's, ending wherever the case puts it
  return {
    kind: 'sat',
    startedAt: new Date(NOW + endsInMs - CLOCK_MINUTES * MINUTE_MS).toISOString(),
    finishedAt,
  }
}

/**
 * Narrows a built entry to the sat arm, which is the only one with a clock to read.
 *
 * @param entry - The entry {@link entryOf} built.
 *
 * @returns The same entry, typed as the sat one it is.
 */
function asSat(entry: HostedCompetitionEntry): SatEntry {
  // Every entry the builder makes is a sat one, and only the type has to be told
  if (entry.kind !== 'sat') {
    throw new Error('The builder only makes sat entries')
  }

  // The same entry, now known to carry a clock
  return entry
}

/**
 * Builds a competition carrying only what the derivations read.
 *
 * @param overrides - Whatever the case under test cares about.
 *
 * @returns The competition.
 */
function competitionOf(overrides: Partial<HostedCompetition> = {}): HostedCompetition {
  // Only what the derivations read, with the case's own facts on top
  return {
    id: 'c',
    category: 'intermediate',
    entry: null,
    resultsPublished: false,
    problemsPublished: false,
    ...overrides,
  }
}

/**
 * Builds a group carrying only what the derivations read.
 *
 * @param overrides - Whatever the case under test cares about.
 *
 * @returns The group.
 */
function groupOf(overrides: Partial<HostedCompetitionGroup> = {}): HostedCompetitionGroup {
  // A group open right now, with the case's own facts on top
  return {
    id: 'september',
    problemCount: 3,
    clockMinutes: CLOCK_MINUTES,
    name: { sk: 'September 2026', cs: 'Září 2026', en: 'September 2026' },
    opensAt: new Date(NOW - 6 * 24 * HOUR_MS).toISOString(),
    closesAt: new Date(NOW + 7 * 24 * HOUR_MS).toISOString(),
    competitions: [competitionOf()],
    ...overrides,
  }
}

describe('derivePhase', () => {
  it('reads a group past its window as closed', () => {
    // Reaching the closing instant is enough to be past it
    expect(derivePhase(groupOf({ closesAt: new Date(NOW).toISOString() }), NOW)).toBe('closed')
  })

  it('takes entries from the opening instant itself', () => {
    // The other end of the window, and the end that belongs to it: a group which announced noon and then
    // refused entries at noon would be advertising a moment nobody can enter in
    expect(derivePhase(groupOf({ opensAt: new Date(NOW).toISOString() }), NOW)).toBe('open')
  })
})

describe('deriveStanding', () => {
  it('reports a clock still running', () => {
    // An hour left on it, and the student has not closed it themselves
    const standing = deriveStanding(
      groupOf(),
      competitionOf({ entry: entryOf(HOUR_MS, null) }),
      NOW
    )

    // Time left and nothing closed by hand
    expect(standing.kind).toBe('running')
  })

  it('reads a clock that has run out as over', () => {
    // Nothing on the server marks an entry finished, so the arithmetic has to
    expect(
      deriveStanding(groupOf(), competitionOf({ entry: entryOf(-HOUR_MS, null) }), NOW).kind
    ).toBe('done')
  })

  it('reads an entry the student handed in as over, whatever the clock still says', () => {
    // An hour of clock left, and the student closed it a minute ago anyway
    const entry = entryOf(HOUR_MS, new Date(NOW - MINUTE_MS).toISOString())

    // Over, because what ends an entry is whichever of the two came first
    expect(deriveStanding(groupOf(), competitionOf({ entry }), NOW).kind).toBe('done')
  })

  it('reads an entry handed in ahead of the reading clock as over rather than as running', () => {
    // The two clocks do not agree to the second: whatever stamped the hand-in can put it a moment after
    // the instant the page is being read against
    const entry = entryOf(HOUR_MS, new Date(NOW + SECOND_MS).toISOString())

    // Over, the stamp settling it on its own. Reading it against the clock instead offers the student a
    // Continue button and a live countdown on an entry they have already closed
    expect(deriveStanding(groupOf(), competitionOf({ entry }), NOW).kind).toBe('done')
  })

  it('reads an entry on the very instant its clock runs out as over', () => {
    // Reaching the end is enough to be past it, the same way a group reaching its closing date is
    expect(deriveStanding(groupOf(), competitionOf({ entry: entryOf(0, null) }), NOW).kind).toBe(
      'done'
    )
  })
})

describe('entryEndsAt', () => {
  it('ends an untouched entry where its clock runs out', () => {
    // Two hours of clock, started an hour ago, so an hour of it is still to come
    const entry = entryOf(HOUR_MS, null)

    // Where the clock puts it, nothing having moved it
    expect(Date.parse(entryEndsAt(groupOf(), asSat(entry)))).toBe(NOW + HOUR_MS)
  })

  it('ends a handed-in entry where the student stopped it', () => {
    // An hour of clock left, handed in a minute ago
    const handedInAt = NOW - MINUTE_MS
    const entry = entryOf(HOUR_MS, new Date(handedInAt).toISOString())

    // Where the student stopped it: the time they left on the clock is not time anything counts in
    expect(Date.parse(entryEndsAt(groupOf(), asSat(entry)))).toBe(handedInAt)
  })

  it('keeps the clock when it ran out before anything closed the entry', () => {
    // The clock died an hour ago, and the record of it being closed came later still
    const entry = entryOf(-HOUR_MS, new Date(NOW).toISOString())

    // The earlier of the two, so nothing sent after the buzzer is pulled back into the counted part
    expect(Date.parse(entryEndsAt(groupOf(), asSat(entry)))).toBe(NOW - HOUR_MS)
  })
})

describe('wasHandedInEarly', () => {
  it('reads a clock that ran its full length as a clock rather than a hand-in', () => {
    // An entry closed at exactly the moment its clock would have closed it, which is what a backend
    // stamping the expiry writes
    const entry = entryOf(0, new Date(NOW).toISOString())

    // Nobody gave anything up: the clock ended it, and the page must not say otherwise
    expect(wasHandedInEarly(groupOf(), asSat(entry))).toBe(false)
  })

  it('reads an entry closed with time still on it as a hand-in', () => {
    // An hour of clock left, and the student stopped a minute ago
    const entry = entryOf(HOUR_MS, new Date(NOW - MINUTE_MS).toISOString())

    // The one thing that separates the two: it ended before the clock would have
    expect(wasHandedInEarly(groupOf(), asSat(entry))).toBe(true)
  })

  it('reads an entry nobody closed as neither', () => {
    // Still running, so there is nothing to have been given up
    expect(wasHandedInEarly(groupOf(), asSat(entryOf(HOUR_MS, null)))).toBe(false)
  })
})

describe('toAreaEntry', () => {
  it('reads no entry as nothing to read a conversation against', () => {
    expect(toAreaEntry(groupOf(), null)).toBeNull()
  })

  it('reads an entry given up for the problems as one no clock ever ran on', () => {
    expect(
      toAreaEntry(groupOf(), { kind: 'forfeited', forfeitedAt: new Date(NOW).toISOString() })
    ).toEqual({ kind: 'forfeited' })
  })

  it('ends a handed-in entry where the student stopped it rather than where its clock would have', () => {
    // Half an hour left on the clock when the student handed it in
    const handedInAt = new Date(NOW - 30 * MINUTE_MS).toISOString()
    const entry = entryOf(30 * MINUTE_MS, handedInAt)

    // Which is where the conversation stops counting, and it reads as the hand-in it was
    expect(toAreaEntry(groupOf(), entry)).toEqual({
      kind: 'sat',
      endsAt: handedInAt,
      wasHandedIn: true,
    })
  })
})

describe('hasEntryEnded', () => {
  /**
   * Builds a sat entry whose counted part ends a given distance from {@link NOW}.
   *
   * @param endsInMs - How long is left of it, negative once it has run out.
   * @param wasHandedIn - Whether the student closed it themselves.
   *
   * @returns The entry as everything inside the area reads it.
   */
  function satEntry(endsInMs: number, wasHandedIn = false): AreaEntry {
    // Only the instant it ends and who ended it decide this
    return {
      kind: 'sat',
      endsAt: new Date(NOW + endsInMs).toISOString(),
      wasHandedIn,
    }
  }

  it('never ends an entry given up for the problems', () => {
    // No clock ever ran on it, so there is no counted part to be over
    expect(hasEntryEnded({ kind: 'forfeited' }, NOW)).toBe(false)
  })

  it('keeps a running clock open', () => {
    expect(hasEntryEnded(satEntry(HOUR_MS), NOW)).toBe(false)
  })

  it('holds the entry open through the second before the last', () => {
    // Two seconds left, which is a second clear of the boundary
    expect(hasEntryEnded(satEntry(2 * SECOND_MS), NOW)).toBe(false)
  })

  it('ends it inside its last second', () => {
    // The countdown reads zero from here, so a sentence saying otherwise contradicts it
    expect(hasEntryEnded(satEntry(SECOND_MS - 1), NOW)).toBe(true)
  })

  it('ends a hand-in with time still on the clock', () => {
    // The student closed it, so what the clock has left is not time anything can still count in
    expect(hasEntryEnded(satEntry(HOUR_MS, true), NOW)).toBe(true)
  })
})

describe('areNotesOpen', () => {
  /** How long the server says notes are still taken after an entry ends, in minutes. */
  const GRACE_MINUTES = 30

  /**
   * Builds a sat entry that stopped counting a given distance from {@link NOW}.
   *
   * @param endedMsAgo - How long ago it stopped, negative while it is still running.
   *
   * @returns The entry as everything inside the area reads it.
   */
  function satEntry(endedMsAgo: number): AreaEntry {
    // Only the instant it ends matters here, the grace hanging off that and nothing else
    return {
      kind: 'sat',
      endsAt: new Date(NOW - endedMsAgo).toISOString(),
      wasHandedIn: false,
    }
  }

  it('asks nothing about an entry given up for the problems', () => {
    // Nothing was sat, so there is no run of theirs to say anything about
    expect(areNotesOpen({ kind: 'forfeited' }, GRACE_MINUTES, NOW)).toBe(false)
  })

  it('takes notes while the clock is still running', () => {
    expect(areNotesOpen(satEntry(-HOUR_MS), GRACE_MINUTES, NOW)).toBe(true)
  })

  it('keeps taking them inside the grace that follows the entry', () => {
    // Twenty-nine minutes past the end, so a minute of the half-hour is still to come
    expect(areNotesOpen(satEntry(29 * MINUTE_MS), GRACE_MINUTES, NOW)).toBe(true)
  })

  it('stops on the instant the grace is spent', () => {
    // Exactly half an hour past the end, which the backend already refuses: read any looser and the page
    // offers a note the server turns away
    expect(areNotesOpen(satEntry(30 * MINUTE_MS), GRACE_MINUTES, NOW)).toBe(false)
  })
})

describe('readAreaRun', () => {
  /** How long the server says notes are still taken after an entry ends, in minutes. */
  const GRACE_MINUTES = 30

  it('reads nothing off an entry given up for the problems', () => {
    // No clock ran on it, so the run is the entry and carries not one reading beside it
    expect(readAreaRun({ kind: 'forfeited' }, GRACE_MINUTES, NOW)).toEqual({ kind: 'forfeited' })
  })

  it('carries a sat entry through with what its clock decides', () => {
    // An hour still to run, so it is neither over nor past taking notes
    const entry: AreaEntry = {
      kind: 'sat',
      endsAt: new Date(NOW + HOUR_MS).toISOString(),
      wasHandedIn: false,
    }

    // Read it against the instant the page is drawn at
    const run = readAreaRun(entry, GRACE_MINUTES, NOW)

    // Which hands back the entry itself, with the two things the clock settles beside it
    expect(run).toEqual({ ...entry, hasEnded: false, areNotesOpen: true })
  })
})

describe('orderForReading', () => {
  /** One of each phase, deliberately listed in the wrong order. */
  const GROUPS: HostedCompetitionGroup[] = [
    groupOf({
      id: 'older',
      opensAt: new Date(NOW - 60 * DAY_MS).toISOString(),
      closesAt: new Date(NOW - 47 * DAY_MS).toISOString(),
    }),
    groupOf({
      id: 'later',
      opensAt: new Date(NOW + 40 * DAY_MS).toISOString(),
      closesAt: new Date(NOW + 53 * DAY_MS).toISOString(),
    }),
    groupOf({
      id: 'sooner',
      opensAt: new Date(NOW + 10 * DAY_MS).toISOString(),
      closesAt: new Date(NOW + 23 * DAY_MS).toISOString(),
    }),
    groupOf({
      id: 'newer',
      opensAt: new Date(NOW - 30 * DAY_MS).toISOString(),
      closesAt: new Date(NOW - 17 * DAY_MS).toISOString(),
    }),
    groupOf({ id: 'open' }),
    groupOf({ id: 'practice', closesAt: null }),
  ]

  it('leads with what can be taken right now', () => {
    // The practice one first, then the group taking entries, whatever the calendar says
    expect(orderForReading(GROUPS, NOW).map((group) => group.id)).toEqual([
      'practice',
      'open',
      'sooner',
      'later',
      'newer',
      'older',
    ])
  })

  it('counts down to the next one and back from the last', () => {
    // Two still to come read soonest first, since the next to happen is the one being waited for
    const ids = orderForReading(GROUPS, NOW).map((group) => group.id)
    expect(ids.indexOf('sooner')).toBeLessThan(ids.indexOf('later'))

    // Two already over read the other way, the one that just closed being the one still talked about
    expect(ids.indexOf('newer')).toBeLessThan(ids.indexOf('older'))
  })

  it('sorts a copy rather than the array it was handed', () => {
    // It is the query cache's own, so sorting it in place would reorder what the cache holds
    orderForReading(GROUPS, NOW)

    // The one that was listed first is still first
    expect(GROUPS[0].id).toBe('older')
  })
})

describe('clockDisplayMode', () => {
  it('is still counting in minutes with exactly five left', () => {
    // The switch belongs inside the closing window, not at the moment it begins
    expect(clockDisplayMode(5 * MINUTE_MS)).toBe('minutes')
  })

  it('counts in seconds once inside the last five minutes', () => {
    // Here the seconds are what a student is actually deciding against
    expect(clockDisplayMode(5 * MINUTE_MS - 1)).toBe('closing')
  })

  it('is still closing with exactly a minute left', () => {
    // The deadline paint belongs inside the last minute, not at the moment it begins
    expect(clockDisplayMode(MINUTE_MS)).toBe('closing')
  })

  it('reads the last minute as the deadline it is', () => {
    // Nothing is left to decide, so the reading stops being information and starts being a warning
    expect(clockDisplayMode(MINUTE_MS - 1)).toBe('final')
  })
})

describe('clockMinuteFraction', () => {
  it('is full on the tick the reading changes', () => {
    // A minute out either way and the drain runs dry while the number still has a minute to sit on
    expect(clockMinuteFraction(29 * MINUTE_MS)).toBe(1)
  })

  it('is spent by the moment the reading is about to change again', () => {
    // A millisecond of the minute left, so the drain has all but gone
    expect(clockMinuteFraction(28 * MINUTE_MS + 1)).toBeCloseTo(0, 4)
  })
})

describe('clockMinutesLeft', () => {
  it('still reads the full length a moment into the entry', () => {
    // The instant the student presses the button, a second of the clock is already gone. Rounded down
    // that reads 1 h 59 min before they have read the first problem, which is a minute they did not spend
    expect(clockMinutesLeft(2 * HOUR_MS - SECOND_MS)).toEqual({ hours: 2, minutes: 0 })
  })

  it('carries a rounded-up hour rather than reporting sixty minutes', () => {
    // Half a second under the hour, which rounds up into the hour itself
    expect(clockMinutesLeft(HOUR_MS - SECOND_MS / 2)).toEqual({ hours: 1, minutes: 0 })
  })

  it('reads the last whole minute as one rather than as none', () => {
    // The boundary the seconds take over at, which still has a minute to name
    expect(clockMinutesLeft(MINUTE_MS)).toEqual({ hours: 0, minutes: 1 })
  })
})
