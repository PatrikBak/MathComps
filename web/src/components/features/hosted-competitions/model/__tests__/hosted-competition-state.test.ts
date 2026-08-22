import { describe, expect, it } from 'vitest'

import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/components/shared/utils/time-units'

import { derivePhase, deriveStanding, orderForReading } from '../hosted-competition-state'
import type {
  HostedCompetition,
  HostedCompetitionEntry,
  HostedCompetitionGroup,
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
  it('puts the practice group outside the schedule', () => {
    // It never closes, so no date of its own could put it anywhere else
    expect(derivePhase(groupOf({ closesAt: null }), NOW)).toBe('practice')
  })

  it('reads a group that has not started as upcoming', () => {
    // Announced, with its problems still embargoed
    expect(derivePhase(groupOf({ opensAt: new Date(NOW + HOUR_MS).toISOString() }), NOW)).toBe(
      'upcoming'
    )
  })

  it('reads a group inside its window as open', () => {
    // Opened days ago and closing days from now, which is the only case entries are taken in
    expect(derivePhase(groupOf(), NOW)).toBe('open')
  })

  it('reads a group past its window as closed', () => {
    // Reaching the closing instant is enough to be past it
    expect(derivePhase(groupOf({ closesAt: new Date(NOW).toISOString() }), NOW)).toBe('closed')
  })
})

describe('deriveStanding', () => {
  it('reports nothing when the competition has not been taken', () => {
    // No entry at all, so there is nothing for a standing to be read off
    expect(deriveStanding(groupOf(), competitionOf(), NOW).kind).toBe('none')
  })

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

  it('reads a given-up entry as given up', () => {
    // A forfeit spends the entry and starts no clock, so there is nothing to read a standing off but this
    const entry: HostedCompetitionEntry = {
      kind: 'forfeited',
      forfeitedAt: new Date(NOW - HOUR_MS).toISOString(),
    }

    // Given up, and nothing else about it is read
    expect(deriveStanding(groupOf(), competitionOf({ entry }), NOW).kind).toBe('forfeited')
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
      id: 'upcoming',
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
      'upcoming',
      'newer',
      'older',
    ])
  })

  it('sorts a copy rather than the array it was handed', () => {
    // It is the query cache's own, so sorting it in place would reorder what the cache holds
    orderForReading(GROUPS, NOW)

    // The one that was listed first is still first
    expect(GROUPS[0].id).toBe('older')
  })
})
